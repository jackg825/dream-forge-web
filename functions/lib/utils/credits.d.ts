/**
 * Check if a user has enough credits
 */
export declare function hasCredits(userId: string, amount?: number): Promise<boolean>;
/**
 * Deduct credits from a user's account
 *
 * Uses a Firestore transaction to ensure atomicity.
 * Returns the job ID for the transaction record.
 */
export declare function deductCredits(userId: string, amount: number, jobId: string): Promise<void>;
/**
 * Refund credits to a user's account
 *
 * Called when a job fails and needs to be rolled back.
 */
export declare function refundCredits(userId: string, amount: number, jobId: string): Promise<void>;
/**
 * Increment the user's total generation count
 */
export declare function incrementGenerationCount(userId: string): Promise<void>;
