"""
Multi-Custodian Consensus & Cold Storage Air-Gap Handshake Service — Phase 21.
Implements institutional M-of-N threshold schemes, time-locked proposal lifecycles,
owner veto mechanics, and offline air-gapped cryptographic handshakes.
"""

import uuid
import hmac
import hashlib
import json
from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field


class ProposalAction(str, Enum):
    EMERGENCY_UNFREEZE = "EMERGENCY_UNFREEZE"
    QUORUM_POLICY_MUTATION = "QUORUM_POLICY_MUTATION"
    ASSET_COLD_TRANSFER = "ASSET_COLD_TRANSFER"
    KMS_MASTER_ROTATION = "KMS_MASTER_ROTATION"


class ProposalState(str, Enum):
    PROPOSED = "PROPOSED"
    COLLECTING_SIGNATURES = "COLLECTING_SIGNATURES"
    TIMELOCK_RUNNING = "TIMELOCK_RUNNING"
    EXECUTABLE = "EXECUTABLE"
    EXECUTED = "EXECUTED"
    VETOED_BY_OWNER = "VETOED_BY_OWNER"


class CustodianSignature(BaseModel):
    custodian_id: str
    signature_hex: str
    public_key: str
    signed_at: str


class CustodianProposal(BaseModel):
    proposal_id: str
    vault_id: str
    action: ProposalAction
    description: str
    threshold_required: int = 3
    total_custodians: int = 5
    signatures: List[CustodianSignature] = Field(default_factory=list)
    state: ProposalState = ProposalState.PROPOSED
    timelock_seconds: int = 0
    timelock_expires_at: Optional[str] = None
    created_at: str


class AirGapEnvelope(BaseModel):
    challenge_id: str
    payload_hash: str
    offline_qr_manifest: str
    nonce: str
    expires_at: str


class CustodianConsensusService:
    """Manages multi-custodian quorum voting and cold storage air-gapped handshakes."""

    def __init__(self):
        self._proposals: Dict[str, CustodianProposal] = {}
        self._airgap_challenges: Dict[str, Dict[str, Any]] = {}
        self._master_airgap_secret = hashlib.sha256(b"securevault_airgap_offline_secret_2026").digest()

    def create_proposal(
        self,
        vault_id: str,
        action: ProposalAction,
        description: str,
        threshold_required: int = 3,
        total_custodians: int = 5,
        timelock_seconds: int = 0,
    ) -> CustodianProposal:
        """Create a new multi-custodian governance proposal."""
        proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        proposal = CustodianProposal(
            proposal_id=proposal_id,
            vault_id=vault_id,
            action=action,
            description=description,
            threshold_required=threshold_required,
            total_custodians=total_custodians,
            signatures=[],
            state=ProposalState.COLLECTING_SIGNATURES,
            timelock_seconds=timelock_seconds,
            timelock_expires_at=None,
            created_at=now,
        )

        self._proposals[proposal_id] = proposal
        return proposal

    def sign_proposal(
        self,
        proposal_id: str,
        custodian_id: str,
        signature_hex: str,
        public_key: str = "pub_custodian_default",
    ) -> CustodianProposal:
        """Append custodian signature and evaluate threshold achievement."""
        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal {proposal_id} not found.")

        if proposal.state not in [ProposalState.PROPOSED, ProposalState.COLLECTING_SIGNATURES]:
            raise ValueError(f"Proposal is in '{proposal.state.value}' state and cannot accept signatures.")

        # Prevent duplicate signature from same custodian
        if any(s.custodian_id == custodian_id for s in proposal.signatures):
            raise ValueError(f"Custodian {custodian_id} has already signed this proposal.")

        now = datetime.now(timezone.utc)
        sig = CustodianSignature(
            custodian_id=custodian_id,
            signature_hex=signature_hex,
            public_key=public_key,
            signed_at=now.isoformat(),
        )
        proposal.signatures.append(sig)

        # Evaluate threshold
        if len(proposal.signatures) >= proposal.threshold_required:
            if proposal.timelock_seconds > 0:
                proposal.state = ProposalState.TIMELOCK_RUNNING
                proposal.timelock_expires_at = (now + timedelta(seconds=proposal.timelock_seconds)).isoformat()
            else:
                proposal.state = ProposalState.EXECUTABLE

        return proposal

    def execute_proposal(self, proposal_id: str) -> CustodianProposal:
        """Execute proposal if threshold is satisfied and timelock has elapsed."""
        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal {proposal_id} not found.")

        now = datetime.now(timezone.utc)

        # Check timelock
        if proposal.state == ProposalState.TIMELOCK_RUNNING:
            if proposal.timelock_expires_at:
                expires = datetime.fromisoformat(proposal.timelock_expires_at)
                if now < expires:
                    raise ValueError(f"Cannot execute proposal. Timelock active until {proposal.timelock_expires_at}.")
            proposal.state = ProposalState.EXECUTABLE

        if proposal.state != ProposalState.EXECUTABLE:
            raise ValueError(f"Cannot execute proposal in state '{proposal.state.value}'. Must be EXECUTABLE.")

        proposal.state = ProposalState.EXECUTED
        return proposal

    def owner_veto_proposal(self, proposal_id: str, owner_id: str, reason: str = "Owner emergency veto") -> CustodianProposal:
        """Allow vault owner to veto and permanently nullify a proposal during voting or timelock."""
        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal {proposal_id} not found.")

        if proposal.state == ProposalState.EXECUTED:
            raise ValueError("Cannot veto a proposal that has already been executed.")

        proposal.state = ProposalState.VETOED_BY_OWNER
        return proposal

    def list_proposals(self, vault_id: Optional[str] = None) -> List[CustodianProposal]:
        """List all proposals, optionally filtered by vault."""
        if vault_id:
            return [p for p in self._proposals.values() if p.vault_id == vault_id]
        return list(self._proposals.values())

    def generate_airgap_challenge(self, payload: Dict[str, Any]) -> AirGapEnvelope:
        """
        Generate offline transaction challenge serializable into an air-gapped QR code.
        Never exposes secrets to network transport.
        """
        challenge_id = f"airgap_{uuid.uuid4().hex[:12]}"
        nonce = uuid.uuid4().hex[:16]
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(minutes=15)).isoformat()

        canon_payload = json.dumps(payload, sort_keys=True)
        payload_hash = hashlib.sha256(canon_payload.encode("utf-8") + nonce.encode("utf-8")).hexdigest()

        # Offline QR Manifest format: SECUREVAULT_AIRGAP:V1:<ID>:<HASH>:<NONCE>
        offline_qr_manifest = f"SECUREVAULT_AIRGAP:V1:{challenge_id}:{payload_hash}:{nonce}"

        envelope = AirGapEnvelope(
            challenge_id=challenge_id,
            payload_hash=payload_hash,
            offline_qr_manifest=offline_qr_manifest,
            nonce=nonce,
            expires_at=expires_at,
        )

        self._airgap_challenges[challenge_id] = {
            "payload_hash": payload_hash,
            "nonce": nonce,
            "expires_at": expires_at,
        }

        return envelope

    def verify_airgap_signature(
        self,
        challenge_id: str,
        public_key_hex: str,
        signature_hex: str,
    ) -> bool:
        """Verify an air-gapped offline signature scanned from cold storage."""
        challenge = self._airgap_challenges.get(challenge_id)
        if not challenge:
            return False

        now = datetime.now(timezone.utc)
        expires = datetime.fromisoformat(challenge["expires_at"])
        if now > expires:
            return False

        # Verify offline signature over payload_hash + nonce using custodian airgap key
        expected_sig = hmac.new(
            self._master_airgap_secret,
            f"{challenge['payload_hash']}:{challenge['nonce']}:{public_key_hex}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(signature_hex, expected_sig)

    def generate_simulated_airgap_signature(self, challenge_id: str, public_key_hex: str) -> str:
        """Helper to generate authentic offline signature for automated tests and HSM simulators."""
        challenge = self._airgap_challenges.get(challenge_id)
        if not challenge:
            raise ValueError(f"Challenge {challenge_id} not found.")

        return hmac.new(
            self._master_airgap_secret,
            f"{challenge['payload_hash']}:{challenge['nonce']}:{public_key_hex}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()


custodian_consensus_service = CustodianConsensusService()
