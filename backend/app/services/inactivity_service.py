"""
Inactivity & Dead Man's Switch Service — SecureVault Enterprise
Handles multi-channel heartbeats, configurable standby thresholds,
cooling periods, emergency pause modes, and multi-stage escalation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.database import db
from app.domain.exceptions import NotFoundError, UnauthorizedError, ValidationError
from app.repositories.user_repository import UserRepository
from app.repositories.audit_repository import AuditRepository
from app.security.hashing import verify_secret
from app.services.base import BaseService


class InactivityService(BaseService):
    def __init__(
        self,
        user_repo: Optional[UserRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
    ):
        super().__init__()
        self.user_repo = user_repo or UserRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.workflows_col = db["verification_workflows"]

    async def record_heartbeat(
        self,
        user_id: str,
        channel: str = "WEB_PORTAL",
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Record an activity heartbeat, resetting the countdown timer."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        update_data = {
            "lastActive": now_iso,
            "lastHeartbeatType": channel,
            "inactivityStage": "ACTIVE",
            "updatedAt": now_iso,
        }

        # If switch was paused, auto-resume on explicit manual heartbeat
        if user.get("switchPaused") and channel == "WEB_PORTAL":
            update_data["switchPaused"] = False
            update_data["switchPauseReason"] = None
            update_data["switchPauseUntil"] = None

        await self.user_repo.update_one({"id": user_id}, {"$set": update_data})

        # Reset any pending workflow cooling/warning states
        await self.workflows_col.update_one(
            {"userId": user_id},
            {
                "$set": {
                    "status": "ACTIVE",
                    "coolingStartedAt": None,
                    "lastActive": now_iso,
                    "updatedAt": now_iso,
                }
            },
        )

        await self.audit_repo.log_event(
            user_id,
            "HEARTBEAT",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"channel": channel, "timestamp": now_iso},
        )

        return {
            "success": True,
            "last_active": now_iso,
            "channel": channel,
            "inactivity_stage": "ACTIVE",
            "message": "Heartbeat recorded successfully. Standby timer reset.",
        }

    async def get_switch_status(self, user_id: str) -> Dict[str, Any]:
        """Compute the live countdown, stage, and milestone dates for the user's switch."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        now = datetime.now(timezone.utc)

        # Standby settings
        inactivity_days = float(
            user.get("inactivityPeriodDays")
            or (float(user.get("inactivityPeriod", 6.0)) * 30)
            or 180
        )
        cooling_days = float(user.get("coolingPeriodDays", 14))
        emergency_contacts = user.get("emergencyContacts", [])
        is_paused = user.get("switchPaused", False)
        pause_reason = user.get("switchPauseReason")
        pause_until = user.get("switchPauseUntil")

        # Check if pause expired
        if is_paused and pause_until:
            try:
                pause_end = datetime.fromisoformat(pause_until)
                if now >= pause_end:
                    is_paused = False
                    await self.user_repo.update_one(
                        {"id": user_id},
                        {"$set": {"switchPaused": False, "switchPauseReason": None, "switchPauseUntil": None}}
                    )
            except Exception:
                pass

        # Calculate time elapsed
        last_active_str = user.get("lastActive") or user.get("createdAt") or now.isoformat()
        try:
            last_active = datetime.fromisoformat(last_active_str)
        except Exception:
            last_active = now

        elapsed_seconds = max(0.0, (now - last_active).total_seconds())
        days_elapsed = round(elapsed_seconds / 86400, 2)
        days_remaining = max(0.0, round(inactivity_days - days_elapsed, 1))
        percentage_elapsed = min(100.0, round((days_elapsed / inactivity_days) * 100, 1)) if inactivity_days > 0 else 100.0

        # Determine stage
        if is_paused:
            stage = "PAUSED"
        elif days_elapsed < 0.5 * inactivity_days:
            stage = "ACTIVE"
        elif days_elapsed < 0.8 * inactivity_days:
            stage = "WARNING_STAGE_1"
        elif days_elapsed < 1.0 * inactivity_days:
            stage = "WARNING_STAGE_2"
        elif days_elapsed < (inactivity_days + cooling_days):
            stage = "COOLING_PERIOD"
        else:
            stage = "SWITCH_TRIGGERED"

        # Milestones
        warning_1_dt = last_active + timedelta(days=0.5 * inactivity_days)
        warning_2_dt = last_active + timedelta(days=0.8 * inactivity_days)
        cooling_start_dt = last_active + timedelta(days=inactivity_days)
        trigger_dt = last_active + timedelta(days=inactivity_days + cooling_days)

        return {
            "user_id": user_id,
            "status": stage,
            "is_paused": is_paused,
            "pause_reason": pause_reason,
            "pause_until": pause_until,
            "inactivity_period_days": inactivity_days,
            "cooling_period_days": cooling_days,
            "emergency_contacts": emergency_contacts,
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "percentage_elapsed": percentage_elapsed,
            "last_active": last_active.isoformat(),
            "last_heartbeat_type": user.get("lastHeartbeatType", "WEB_PORTAL"),
            "milestones": {
                "warning_stage_1": warning_1_dt.isoformat(),
                "warning_stage_2": warning_2_dt.isoformat(),
                "cooling_period_start": cooling_start_dt.isoformat(),
                "claim_trigger_date": trigger_dt.isoformat(),
            },
        }

    async def configure_switch(
        self,
        user_id: str,
        inactivity_days: int,
        cooling_days: int,
        emergency_contacts: Optional[List[str]] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Update standby thresholds and emergency escalation contacts."""
        if inactivity_days < 1:
            raise ValidationError("Inactivity threshold must be at least 1 day")
        if cooling_days < 1:
            raise ValidationError("Cooling period must be at least 1 day")

        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "inactivityPeriodDays": inactivity_days,
            "inactivityPeriod": round(inactivity_days / 30.0, 1),  # Legacy months sync
            "coolingPeriodDays": cooling_days,
            "emergencyContacts": emergency_contacts or [],
            "updatedAt": now_iso,
        }

        await self.user_repo.update_one({"id": user_id}, {"$set": update_data})

        await self.audit_repo.log_event(
            user_id,
            "SWITCH_CONFIG_UPDATE",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"inactivityDays": inactivity_days, "coolingDays": cooling_days},
        )

        return {
            "success": True,
            "inactivity_period_days": inactivity_days,
            "cooling_period_days": cooling_days,
            "emergency_contacts": emergency_contacts or [],
            "message": "Dead Man's Switch parameters updated successfully",
        }

    async def pause_switch(
        self,
        user_id: str,
        pin: str,
        reason: Optional[str] = None,
        resume_date: Optional[str] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Pause switch countdown with secondary PIN verification."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        # PIN verification required
        user_pin = user.get("pin")
        if not user_pin or not verify_secret(pin, user_pin):
            raise UnauthorizedError("Invalid master PIN for pausing Dead Man's Switch")

        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "switchPaused": True,
            "switchPauseReason": reason or "Emergency Pause by Owner",
            "switchPauseUntil": resume_date,
            "updatedAt": now_iso,
        }

        await self.user_repo.update_one({"id": user_id}, {"$set": update_data})

        await self.audit_repo.log_event(
            user_id,
            "SWITCH_PAUSED",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"reason": reason, "resumeDate": resume_date},
        )

        return {
            "success": True,
            "is_paused": True,
            "reason": reason,
            "pause_until": resume_date,
            "message": "Dead Man's Switch paused successfully",
        }

    async def resume_switch(
        self,
        user_id: str,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Resume switch countdown and record a heartbeat."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "switchPaused": False,
            "switchPauseReason": None,
            "switchPauseUntil": None,
            "lastActive": now_iso,
            "inactivityStage": "ACTIVE",
            "updatedAt": now_iso,
        }

        await self.user_repo.update_one({"id": user_id}, {"$set": update_data})

        await self.audit_repo.log_event(
            user_id,
            "SWITCH_RESUMED",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return {
            "success": True,
            "is_paused": False,
            "last_active": now_iso,
            "message": "Dead Man's Switch resumed and timer reset",
        }

    async def evaluate_inactivity_state(self, user_id: str) -> str:
        """Evaluate and persist the current inactivity stage for the user."""
        status = await self.get_switch_status(user_id)
        current_stage = status["status"]

        await self.user_repo.update_one(
            {"id": user_id},
            {"$set": {"inactivityStage": current_stage}}
        )

        # Update verification workflow status
        workflow_status = (
            "COOLING_PERIOD" if current_stage == "COOLING_PERIOD"
            else "CLAIM_INITIATED" if current_stage == "SWITCH_TRIGGERED"
            else "ACTIVE"
        )
        await self.workflows_col.update_one(
            {"userId": user_id},
            {"$set": {"status": workflow_status, "inactivityStage": current_stage}},
            upsert=True,
        )

        return current_stage
