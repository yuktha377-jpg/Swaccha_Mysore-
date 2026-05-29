# Security Specification for Mysore Swachha

## Data Invariants
1. A report must have a valid `userId` matching the creator.
2. A report's `status` can only be changed by municipal staff/admin.
3. Users can only read their own reports and all public announcements/vehicles.
4. Municipal staff can read all reports and vehicles.
5. Only staff/admin can create announcements or update vehicle status.

## The "Dirty Dozen" Payloads
1. **Unauthorized Create**: Report with `userId` of another user. (DENIED)
2. **Staff Privilege Escalation**: Citizen trying to update `status` to 'completed'. (DENIED)
3. **Ghost Field Injection**: Adding `isVerified: true` to a report. (DENIED)
4. **ID Poisoning**: Submitting a report with a 2KB string as ID. (DENIED)
5. **PII Leak**: Citizen trying to read another user's profile. (DENIED)
6. **Self-Promotion**: Citizen trying to set their own role to 'admin' in `users` collection. (DENIED)
7. **Junk Announcement**: Citizen posting an announcement. (DENIED)
8. **Invalid Category**: Report with category 'candy'. (DENIED)
9. **Negative Fuel**: Updating vehicle fuel to -100 (if added). (N/A but good to consider)
10. **Orphaned Report**: Report referencing a non-existent `userId`. (DENIED)
11. **Massive Description**: 1MB string in description. (DENIED)
12. **Future Timestamp**: Submitting a report with a timestamp 1 year in the future. (DENIED)

## Test Runner
Verified via `firestore.rules`.
