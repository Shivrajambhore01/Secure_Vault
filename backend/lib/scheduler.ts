import cron from "node-cron";
import clientPromise from "./mongodb";
import { processReEngagementForUser } from "../routes/auth";

// How often the cron job runs
const CRON_SCHEDULE = "* * * * *"; // every minute

export function startInactivityScheduler() {
    const testMode = process.env.INACTIVITY_TEST_MODE === "true";
    console.log(`[RE-ENGAGEMENT-V4] Scheduler Starting. Mode: ${testMode ? "TEST" : "PROD"}`);

    cron.schedule(CRON_SCHEDULE, async () => {
        try {
            const client = await clientPromise;
            const db = client.db("securevault");
            const users = db.collection("users");

            // STEP 1: FIND LOGGED-OUT USERS
            // We ONLY process users who have explicitly logged out (logoutTime is not null)
            const inactiveUsers = await users.find({
                logoutTime: { $ne: null }
            }).toArray();

            console.log(`[RE-ENGAGEMENT-V4] Found ${inactiveUsers.length} logged-out users to process.`);

            // STEP 2: PROCESS ALL USERS IN PARALLEL
            // Using allSettled so one user's error doesn't stop others
            await Promise.allSettled(inactiveUsers.map(async (user) => {
                try {
                    await processReEngagementForUser(user._id.toString());
                } catch (userError: any) {
                    console.error(`[RE-ENGAGEMENT-V4] Error for ${user.email}:`, userError.message);
                }
            }));

            if (inactiveUsers.length > 0) {
                console.log(`[RE-ENGAGEMENT-V4] Finished processing batch of ${inactiveUsers.length} users.`);
            }
        } catch (error) {
            console.error("[RE-ENGAGEMENT-V4] Global Error:", error);
        }
    });
}
