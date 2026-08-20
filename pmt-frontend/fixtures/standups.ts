import type { Standup } from '@/types/standups';

/**
 * Real reports from the seeded database, captured 2026-08-20 as an admin, so
 * each row carries its `user` (a manager asking for nobody gets the whole team).
 */
export const STANDUP_ROWS = [
    {
        "id": "7c3c0f4a-cff0-4a48-8296-c80ea84bcfbb",
        "userId": "qyRia7yDNmADQs9NcBuWpH7onggXI1kR",
        "user": {
            "id": "qyRia7yDNmADQs9NcBuWpH7onggXI1kR",
            "name": "Anis Sheikh",
            "email": "anis.sheikh@pixelvega.com"
        },
        "date": "2026-08-19",
        "status": {
            "value": "COMPLETED",
            "label": "Completed",
            "tone": "success"
        },
        "planSubmittedAt": "2026-08-19T03:41:00.000Z",
        "wrapUpSubmittedAt": "2026-08-19T13:04:00.000Z",
        "entries": [
            {
                "id": "e3cf193e-c970-4642-afa0-4d0ad1baebb9",
                "dailyWorkReportId": "7c3c0f4a-cff0-4a48-8296-c80ea84bcfbb",
                "projectId": "918c8336-b263-4e04-bae9-8e92e0e41b80",
                "project": {
                    "id": "918c8336-b263-4e04-bae9-8e92e0e41b80",
                    "name": "Redwood Systems Careers Site"
                },
                "plan": "Write the redirect map for the old URLs.",
                "accomplishments": "Metadata pass done on half the templates, rest tomorrow.",
                "hasPlan": true,
                "hasWrapUp": true,
                "reviewedBy": null,
                "reviewedAt": null,
                "reviewComment": null,
                "isReviewed": false,
                "capabilities": {
                    "canReview": true
                }
            },
            {
                "id": "f8c4b6b9-62fa-49c4-8f27-a6533f73b6ff",
                "dailyWorkReportId": "7c3c0f4a-cff0-4a48-8296-c80ea84bcfbb",
                "projectId": "a235b4f6-98e9-4209-951a-eb531cb6d9df",
                "project": {
                    "id": "a235b4f6-98e9-4209-951a-eb531cb6d9df",
                    "name": "Atlas Labs Intranet"
                },
                "plan": "Build the pricing table component.",
                "accomplishments": "Metadata pass done on half the templates, rest tomorrow.",
                "hasPlan": true,
                "hasWrapUp": true,
                "reviewedBy": null,
                "reviewedAt": null,
                "reviewComment": null,
                "isReviewed": false,
                "capabilities": {
                    "canReview": true
                }
            }
        ],
        "entryCount": 2,
        "createdAt": "2026-08-19T03:41:00.000Z",
        "updatedAt": "2026-08-19T13:04:00.000Z",
        "capabilities": {
            "canEditPlan": false,
            "canEditWrapUp": false,
            "canSubmitWrapUp": false
        }
    },
    {
        "id": "8bb48c4a-356a-444e-8196-25d3b4d88fbe",
        "userId": "prpTGOJXJRheGxxqhm4bvqevuhz1LN2c",
        "user": {
            "id": "prpTGOJXJRheGxxqhm4bvqevuhz1LN2c",
            "name": "Anna Johnson",
            "email": "anna.johnson@pixelvega.com"
        },
        "date": "2026-08-19",
        "status": {
            "value": "PLAN_SUBMITTED",
            "label": "Plan submitted",
            "tone": "warning"
        },
        "planSubmittedAt": "2026-08-19T03:36:00.000Z",
        "wrapUpSubmittedAt": null,
        "entries": [
            {
                "id": "1a84f0e1-397a-4a53-992c-3d5383b3a3dd",
                "dailyWorkReportId": "8bb48c4a-356a-444e-8196-25d3b4d88fbe",
                "projectId": "e0d74852-6d44-4941-a938-5585a40d203e",
                "project": {
                    "id": "e0d74852-6d44-4941-a938-5585a40d203e",
                    "name": "Lighthouse Health Event Microsite"
                },
                "plan": "Set up the staging environment and share the link.",
                "accomplishments": null,
                "hasPlan": true,
                "hasWrapUp": false,
                "reviewedBy": null,
                "reviewedAt": null,
                "reviewComment": null,
                "isReviewed": false,
                "capabilities": {
                    "canReview": true
                }
            },
            {
                "id": "68291869-32df-460f-8d8b-518b3e4270ee",
                "dailyWorkReportId": "8bb48c4a-356a-444e-8196-25d3b4d88fbe",
                "projectId": "bab069c7-34c3-4527-aa90-1e98ba633d24",
                "project": {
                    "id": "bab069c7-34c3-4527-aa90-1e98ba633d24",
                    "name": "Skyline Retail Marketing Site"
                },
                "plan": "Build the pricing table component.",
                "accomplishments": null,
                "hasPlan": true,
                "hasWrapUp": false,
                "reviewedBy": null,
                "reviewedAt": null,
                "reviewComment": null,
                "isReviewed": false,
                "capabilities": {
                    "canReview": true
                }
            }
        ],
        "entryCount": 2,
        "createdAt": "2026-08-19T03:36:00.000Z",
        "updatedAt": "2026-08-19T03:36:00.000Z",
        "capabilities": {
            "canEditPlan": false,
            "canEditWrapUp": false,
            "canSubmitWrapUp": false
        }
    }
] as unknown as Standup[];
