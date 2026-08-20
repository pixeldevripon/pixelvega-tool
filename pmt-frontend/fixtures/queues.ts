import type { AuditLogEntry } from '@/types/audit-logs';
import type { LeaveRequest } from '@/types/leave';
import type { User } from '@/types/users';
import type { Blocker } from '@/types/blockers';
/**
 * Real rows from the seeded database, captured 2026-08-20.
 *
 * Captured rather than hand written. A hand written fixture agrees with whatever
 * the author believed the API sends, which is how a view ends up reading a field
 * that is not there: `leave.user.role` was a bare string and `audit.actionLabel`
 * did not exist until this work, and only a real payload showed it.
 */

export const BLOCKER_ROWS = [
    {
        "id": "7a2d6f72-5333-4293-a4c5-52f3dab2f31a",
        "projectId": "dc68a526-c7d0-41d0-b5f4-430a321c4230",
        "project": {
            "id": "dc68a526-c7d0-41d0-b5f4-430a321c4230",
            "name": "Test Client Company Speed Optimisation"
        },
        "description": "The API we integrate with started returning 429 on every call.",
        "status": {
            "value": "RESOLVED",
            "label": "Resolved",
            "tone": "success"
        },
        "severity": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "reason": {
            "id": "da055079-8ba3-4bbe-90fc-b9a443107c95",
            "name": "Key person on leave",
            "createdAt": "2025-07-15T00:00:00.000Z",
            "updatedAt": "2026-08-20T12:42:47.160Z"
        },
        "reportedBy": {
            "id": "nm0JXVfcKw0LvyfWT6eimalQkcw0I1Tk",
            "name": "Test Designer",
            "email": "designer@pixelvega.com"
        },
        "assignedTo": {
            "id": "1b4SEZ0HkDjC2B8htCcK2zaUL5Rv3o4l",
            "name": "Ava Sultana",
            "email": "ava.sultana2@pixelvega.com"
        },
        "assignedAt": "2026-08-19T17:36:54.983Z",
        "resolvedBy": {
            "id": "1b4SEZ0HkDjC2B8htCcK2zaUL5Rv3o4l",
            "name": "Ava Sultana",
            "email": "ava.sultana2@pixelvega.com"
        },
        "resolvedAt": "2026-08-22T01:34:49.461Z",
        "resolutionNotes": "Added caching and backoff, calls are stable now.",
        "deadlineExtensionDays": 2,
        "isResolved": true,
        "resolutionMinutes": 2038,
        "resolutionLabel": "33h 58m",
        "ageMinutes": 2038,
        "ageLabel": "33h 58m",
        "daysOpen": null,
        "causedDeadlineExtension": true,
        "createdAt": "2026-08-20T15:36:49.461Z",
        "updatedAt": "2026-08-22T01:34:49.461Z",
        "capabilities": {
            "canEdit": false,
            "canChangeStatus": false,
            "canResolve": false,
            "canReassign": false
        }
    },
    {
        "id": "aa32e3cf-73b2-4394-a0dc-69477a251ff3",
        "projectId": "02091528-7c1f-4ffb-bee2-a1c6a5fd9f68",
        "project": {
            "id": "02091528-7c1f-4ffb-bee2-a1c6a5fd9f68",
            "name": "Test Client Company Event Microsite"
        },
        "description": "The CMS collection hit its item limit, so new posts fail to save.",
        "status": {
            "value": "OPEN",
            "label": "Open",
            "tone": "danger"
        },
        "severity": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "reason": {
            "id": "637d29b9-08d3-4477-bc34-6afb5ad6490a",
            "name": "Shopify app failing",
            "createdAt": "2025-07-15T00:00:00.000Z",
            "updatedAt": "2025-07-15T00:00:00.000Z"
        },
        "reportedBy": {
            "id": "3OIigS1u8rYHj5lHRriNv8eKGFMaEuZo",
            "name": "Test Project Manager",
            "email": "pm@pixelvega.com"
        },
        "assignedTo": null,
        "assignedAt": null,
        "resolvedBy": null,
        "resolvedAt": null,
        "resolutionNotes": null,
        "deadlineExtensionDays": null,
        "isResolved": false,
        "resolutionMinutes": null,
        "resolutionLabel": null,
        "ageMinutes": 3191,
        "ageLabel": "53h 11m",
        "daysOpen": 2,
        "causedDeadlineExtension": false,
        "createdAt": "2026-08-18T07:49:35.328Z",
        "updatedAt": "2026-08-18T07:49:35.328Z",
        "capabilities": {
            "canEdit": true,
            "canChangeStatus": true,
            "canResolve": true,
            "canReassign": true
        }
    },
    {
        "id": "eabfaa75-c5f1-4123-adb5-1f7efbdaff2f",
        "projectId": "56a9329c-cddf-4fa0-bdfe-228e62c1346e",
        "project": {
            "id": "56a9329c-cddf-4fa0-bdfe-228e62c1346e",
            "name": "Onyx Works Event Microsite"
        },
        "description": "Nobody has admin access to the DNS panel.",
        "status": {
            "value": "OPEN",
            "label": "Open",
            "tone": "danger"
        },
        "severity": {
            "value": "MEDIUM",
            "label": "Medium",
            "tone": "warning"
        },
        "reason": {
            "id": "6d00194f-84a1-489b-bfc7-29c58680196d",
            "name": "Redis queue blocked",
            "createdAt": "2025-07-15T00:00:00.000Z",
            "updatedAt": "2025-07-15T00:00:00.000Z"
        },
        "reportedBy": {
            "id": "jcPfmHlwzBZsFa1wdyqUBjNCkuNvtDbx",
            "name": "Tania Anderson",
            "email": "tania.anderson@pixelvega.com"
        },
        "assignedTo": null,
        "assignedAt": null,
        "resolvedBy": null,
        "resolvedAt": null,
        "resolutionNotes": null,
        "deadlineExtensionDays": null,
        "isResolved": false,
        "resolutionMinutes": null,
        "resolutionLabel": null,
        "ageMinutes": 3802,
        "ageLabel": "63h 22m",
        "daysOpen": 2,
        "causedDeadlineExtension": false,
        "createdAt": "2026-08-17T21:39:11.918Z",
        "updatedAt": "2026-08-17T21:39:11.918Z",
        "capabilities": {
            "canEdit": true,
            "canChangeStatus": true,
            "canResolve": true,
            "canReassign": true
        }
    },
    {
        "id": "4a7c2403-6f3d-4ea5-ace4-fec45663911a",
        "projectId": "b58d7045-8a82-4763-b26f-3ccf61b3a1ac",
        "project": {
            "id": "b58d7045-8a82-4763-b26f-3ccf61b3a1ac",
            "name": "Ironclad Commerce Careers Site"
        },
        "description": "Fonts render differently on Safari and the client rejected it.",
        "status": {
            "value": "RESOLVED",
            "label": "Resolved",
            "tone": "success"
        },
        "severity": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "reason": {
            "id": "e0654550-a676-4880-92e0-f3edfffc7f61",
            "name": "Vercel deploy failing",
            "createdAt": "2025-07-15T00:00:00.000Z",
            "updatedAt": "2025-07-15T00:00:00.000Z"
        },
        "reportedBy": {
            "id": "M0yJiXl0NWMVVFZR684dIVURtlyuU26x",
            "name": "Rakib Alam",
            "email": "rakib.alam@pixelvega.com"
        },
        "assignedTo": {
            "id": "Z7J4vorcDjBRw1OtGb99WmwhofRdHc40",
            "name": "Rumana Thomas",
            "email": "rumana.thomas@pixelvega.com"
        },
        "assignedAt": "2026-08-18T09:52:46.403Z",
        "resolvedBy": {
            "id": "Z7J4vorcDjBRw1OtGb99WmwhofRdHc40",
            "name": "Rumana Thomas",
            "email": "rumana.thomas@pixelvega.com"
        },
        "resolvedAt": "2026-08-19T22:01:47.799Z",
        "resolutionNotes": "Whitelisted our office IP with the provider.",
        "deadlineExtensionDays": null,
        "isResolved": true,
        "resolutionMinutes": 3091,
        "resolutionLabel": "51h 31m",
        "ageMinutes": 3091,
        "ageLabel": "51h 31m",
        "daysOpen": null,
        "causedDeadlineExtension": false,
        "createdAt": "2026-08-17T18:30:47.799Z",
        "updatedAt": "2026-08-19T22:01:47.799Z",
        "capabilities": {
            "canEdit": false,
            "canChangeStatus": false,
            "canResolve": false,
            "canReassign": false
        }
    },
    {
        "id": "c63102d5-e046-465e-a2d5-556c03af9c82",
        "projectId": "f0875f28-7e7a-4533-9c43-601f89ef48c8",
        "project": {
            "id": "f0875f28-7e7a-4533-9c43-601f89ef48c8",
            "name": "Evergreen Partners Ticketing Flow"
        },
        "description": "Fonts render differently on Safari and the client rejected it.",
        "status": {
            "value": "IN_PROGRESS",
            "label": "In progress",
            "tone": "warning"
        },
        "severity": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "reason": {
            "id": "eba686ef-ca73-4f8e-bc6e-d79dcad1ab88",
            "name": "Stripe webhook not configured",
            "createdAt": "2025-07-15T00:00:00.000Z",
            "updatedAt": "2025-07-15T00:00:00.000Z"
        },
        "reportedBy": {
            "id": "qfPs5CUmVeSa0u7keNtNET4jKnaI3ziw",
            "name": "Hiroshi Rahman",
            "email": "hiroshi.rahman@pixelvega.com"
        },
        "assignedTo": {
            "id": "qfPs5CUmVeSa0u7keNtNET4jKnaI3ziw",
            "name": "Hiroshi Rahman",
            "email": "hiroshi.rahman@pixelvega.com"
        },
        "assignedAt": "2026-08-17T17:15:59.487Z",
        "resolvedBy": null,
        "resolvedAt": null,
        "resolutionNotes": null,
        "deadlineExtensionDays": null,
        "isResolved": false,
        "resolutionMinutes": null,
        "resolutionLabel": null,
        "ageMinutes": 4520,
        "ageLabel": "75h 20m",
        "daysOpen": 3,
        "causedDeadlineExtension": false,
        "createdAt": "2026-08-17T09:41:04.961Z",
        "updatedAt": "2026-08-17T17:15:59.487Z",
        "capabilities": {
            "canEdit": true,
            "canChangeStatus": true,
            "canResolve": true,
            "canReassign": true
        }
    },
    {
        "id": "20d5a42a-f295-4e5b-aa8b-f9f7d333e051",
        "projectId": "61c3d315-0f71-4350-bc89-3f747c498baa",
        "project": {
            "id": "61c3d315-0f71-4350-bc89-3f747c498baa",
            "name": "Riverstone Solutions Speed Optimisation"
        },
        "description": "We cannot reach the payment sandbox from our IP range.",
        "status": {
            "value": "OPEN",
            "label": "Open",
            "tone": "danger"
        },
        "severity": {
            "value": "HIGH",
            "label": "High",
            "tone": "danger"
        },
        "reason": {
            "id": "346f8dc8-8547-4dc8-a308-acd92bda4b3b",
            "name": "Framer component blocked",
            "createdAt": "2025-07-15T00:00:00.000Z",
            "updatedAt": "2025-07-15T00:00:00.000Z"
        },
        "reportedBy": {
            "id": "hyou7GkbZMpjqsvAS7WGFchKv7zIHqni",
            "name": "Arif Mia",
            "email": "arif.mia@pixelvega.com"
        },
        "assignedTo": null,
        "assignedAt": null,
        "resolvedBy": null,
        "resolvedAt": null,
        "resolutionNotes": null,
        "deadlineExtensionDays": null,
        "isResolved": false,
        "resolutionMinutes": null,
        "resolutionLabel": null,
        "ageMinutes": 6526,
        "ageLabel": "108h 46m",
        "daysOpen": 4,
        "causedDeadlineExtension": false,
        "createdAt": "2026-08-16T00:14:54.447Z",
        "updatedAt": "2026-08-16T00:14:54.447Z",
        "capabilities": {
            "canEdit": true,
            "canChangeStatus": true,
            "canResolve": true,
            "canReassign": true
        }
    }
] as unknown as Blocker[];

export const USER_ROWS = [
    {
        "id": "HlIK9LLtEffSyDhPFuT82kiZvlTE1bEX",
        "email": "andre@skyline-collective.com",
        "name": "Andre Hossain",
        "role": {
            "value": "CLIENT",
            "label": "Client",
            "tone": "default"
        },
        "status": {
            "value": "ACTIVE",
            "label": "Active",
            "tone": "success"
        },
        "slackUserId": null,
        "mustResetPassword": false,
        "createdById": "QY7VqFteIso8rqLzavhOa3PSDjZBsftm",
        "createdAt": "2025-09-25T23:02:47.266Z",
        "updatedAt": "2025-12-05T03:17:50.637Z"
    },
    {
        "id": "knGIqKi0bAFONF5DmehYfla7dq9hUjks",
        "email": "andre.mia@pixelvega.com",
        "name": "Andre Mia",
        "role": {
            "value": "DESIGNER",
            "label": "Designer",
            "tone": "default"
        },
        "status": {
            "value": "INVITED",
            "label": "Invited",
            "tone": "warning"
        },
        "slackUserId": null,
        "mustResetPassword": true,
        "createdById": "QY7VqFteIso8rqLzavhOa3PSDjZBsftm",
        "createdAt": "2025-11-05T18:18:20.933Z",
        "updatedAt": "2026-03-10T18:11:31.874Z"
    },
    {
        "id": "wVMmw0rgBw0AfhYkmPc9nesXi7WW4M2D",
        "email": "andre@wildflower-realty.com",
        "name": "Andre Molla",
        "role": {
            "value": "CLIENT",
            "label": "Client",
            "tone": "default"
        },
        "status": {
            "value": "ACTIVE",
            "label": "Active",
            "tone": "success"
        },
        "slackUserId": null,
        "mustResetPassword": false,
        "createdById": "QY7VqFteIso8rqLzavhOa3PSDjZBsftm",
        "createdAt": "2025-11-14T04:21:03.996Z",
        "updatedAt": "2026-04-02T20:39:04.452Z"
    },
    {
        "id": "yeKCUVJqnUUADrFFYIEa9kBaHI8TXxWR",
        "email": "andre@quartz-holdings.com",
        "name": "Andre Molla",
        "role": {
            "value": "CLIENT",
            "label": "Client",
            "tone": "default"
        },
        "status": {
            "value": "ACTIVE",
            "label": "Active",
            "tone": "success"
        },
        "slackUserId": null,
        "mustResetPassword": false,
        "createdById": "QY7VqFteIso8rqLzavhOa3PSDjZBsftm",
        "createdAt": "2025-04-28T09:43:03.480Z",
        "updatedAt": "2025-11-19T14:53:31.906Z"
    },
    {
        "id": "7QdBJx8XTUcVuPb5QhCcJIfxRFBurVmj",
        "email": "andre@wildflower-commerce.com",
        "name": "Andre Novak",
        "role": {
            "value": "CLIENT",
            "label": "Client",
            "tone": "default"
        },
        "status": {
            "value": "ACTIVE",
            "label": "Active",
            "tone": "success"
        },
        "slackUserId": null,
        "mustResetPassword": false,
        "createdById": "QY7VqFteIso8rqLzavhOa3PSDjZBsftm",
        "createdAt": "2025-12-16T19:45:42.498Z",
        "updatedAt": "2026-07-30T01:25:28.184Z"
    },
    {
        "id": "YOBA9N2L2NUyeFMtpIe8aYiTNNLkbTAE",
        "email": "andre@lighthouse-brands.com",
        "name": "Andre Rodriguez",
        "role": {
            "value": "CLIENT",
            "label": "Client",
            "tone": "default"
        },
        "status": {
            "value": "ACTIVE",
            "label": "Active",
            "tone": "success"
        },
        "slackUserId": null,
        "mustResetPassword": false,
        "createdById": "QY7VqFteIso8rqLzavhOa3PSDjZBsftm",
        "createdAt": "2026-08-02T23:51:54.569Z",
        "updatedAt": "2026-08-16T16:28:01.017Z"
    }
] as unknown as User[];

export const LEAVE_ROWS = [
    {
        "id": "f2761a0d-ae43-4781-95dc-43d98a9fd8c0",
        "userId": "0iKfBcLAhB1E1NiR6A1sgfqvXga8G69z",
        "user": {
            "id": "0iKfBcLAhB1E1NiR6A1sgfqvXga8G69z",
            "name": "Rayhan Brown",
            "email": "rayhan.brown@pixelvega.com",
            "role": {
                "value": "DEVELOPER",
                "label": "Developer",
                "tone": "default"
            }
        },
        "leaveType": {
            "id": "2fdf3496-0d8a-4d22-b33f-730dd4aee9ed",
            "name": "Paternity Leave",
            "defaultDaysPerYear": 10,
            "createdAt": "2025-03-17T00:00:00.000Z",
            "updatedAt": "2025-03-17T00:00:00.000Z"
        },
        "startDate": "2026-12-21",
        "endDate": "2026-12-21",
        "days": 1,
        "reason": "Recovering from a minor surgery.",
        "status": {
            "value": "PENDING",
            "label": "Pending",
            "tone": "warning"
        },
        "reviewedBy": null,
        "reviewedAt": null,
        "isPending": true,
        "createdAt": "2026-12-14T00:00:00.000Z",
        "updatedAt": "2026-12-14T00:00:00.000Z",
        "capabilities": {
            "canApprove": true,
            "canReject": true,
            "canCancel": false
        }
    },
    {
        "id": "2b28c182-1a72-410f-8225-445367fe75fc",
        "userId": "kRJ8aMxUF4tGVq2UNixsXm9QdlOhLN4S",
        "user": {
            "id": "kRJ8aMxUF4tGVq2UNixsXm9QdlOhLN4S",
            "name": "Isabella Akter",
            "email": "isabella.akter@pixelvega.com",
            "role": {
                "value": "DEVELOPER",
                "label": "Developer",
                "tone": "default"
            }
        },
        "leaveType": {
            "id": "acd182e3-ebfd-466a-8bb1-d8d4dcbeddba",
            "name": "Sabbatical",
            "defaultDaysPerYear": 60,
            "createdAt": "2025-03-17T00:00:00.000Z",
            "updatedAt": "2025-03-17T00:00:00.000Z"
        },
        "startDate": "2026-12-15",
        "endDate": "2026-12-18",
        "days": 4,
        "reason": "Recovering from a minor surgery.",
        "status": {
            "value": "PENDING",
            "label": "Pending",
            "tone": "warning"
        },
        "reviewedBy": null,
        "reviewedAt": null,
        "isPending": true,
        "createdAt": "2026-12-12T00:00:00.000Z",
        "updatedAt": "2026-12-12T00:00:00.000Z",
        "capabilities": {
            "canApprove": true,
            "canReject": true,
            "canCancel": false
        }
    },
    {
        "id": "31c35532-2da8-4f33-aa85-6ceb0c23d76c",
        "userId": "kRJ8aMxUF4tGVq2UNixsXm9QdlOhLN4S",
        "user": {
            "id": "kRJ8aMxUF4tGVq2UNixsXm9QdlOhLN4S",
            "name": "Isabella Akter",
            "email": "isabella.akter@pixelvega.com",
            "role": {
                "value": "DEVELOPER",
                "label": "Developer",
                "tone": "default"
            }
        },
        "leaveType": {
            "id": "29e0af8d-172d-4f7f-b7d0-6c1092f62843",
            "name": "Annual Leave",
            "defaultDaysPerYear": 20,
            "createdAt": "2025-03-17T00:00:00.000Z",
            "updatedAt": "2025-03-17T00:00:00.000Z"
        },
        "startDate": "2026-12-19",
        "endDate": "2026-12-19",
        "days": 1,
        "reason": "Taking my parents for a medical checkup.",
        "status": {
            "value": "PENDING",
            "label": "Pending",
            "tone": "warning"
        },
        "reviewedBy": null,
        "reviewedAt": null,
        "isPending": true,
        "createdAt": "2026-12-10T00:00:00.000Z",
        "updatedAt": "2026-12-10T00:00:00.000Z",
        "capabilities": {
            "canApprove": true,
            "canReject": true,
            "canCancel": false
        }
    },
    {
        "id": "3889f1f5-0acd-4f12-914f-8d466b1e8d41",
        "userId": "WUgq9wL2vbNYNvZlQgEpe4iyLvA61SAc",
        "user": {
            "id": "WUgq9wL2vbNYNvZlQgEpe4iyLvA61SAc",
            "name": "Pavel Brown",
            "email": "pavel.brown@pixelvega.com",
            "role": {
                "value": "DEVELOPER",
                "label": "Developer",
                "tone": "default"
            }
        },
        "leaveType": {
            "id": "29e0af8d-172d-4f7f-b7d0-6c1092f62843",
            "name": "Annual Leave",
            "defaultDaysPerYear": 20,
            "createdAt": "2025-03-17T00:00:00.000Z",
            "updatedAt": "2025-03-17T00:00:00.000Z"
        },
        "startDate": "2026-12-17",
        "endDate": "2026-12-17",
        "days": 1,
        "reason": "Short trip already booked before joining.",
        "status": {
            "value": "PENDING",
            "label": "Pending",
            "tone": "warning"
        },
        "reviewedBy": null,
        "reviewedAt": null,
        "isPending": true,
        "createdAt": "2026-12-02T00:00:00.000Z",
        "updatedAt": "2026-12-02T00:00:00.000Z",
        "capabilities": {
            "canApprove": true,
            "canReject": true,
            "canCancel": false
        }
    },
    {
        "id": "0d9b796c-fb74-40f2-adec-fb1d037f4ba3",
        "userId": "qyRia7yDNmADQs9NcBuWpH7onggXI1kR",
        "user": {
            "id": "qyRia7yDNmADQs9NcBuWpH7onggXI1kR",
            "name": "Anis Sheikh",
            "email": "anis.sheikh@pixelvega.com",
            "role": {
                "value": "DESIGNER",
                "label": "Designer",
                "tone": "default"
            }
        },
        "leaveType": {
            "id": "075c01bb-caa0-491e-a153-7b6f702fb215",
            "name": "Half Day Leave",
            "defaultDaysPerYear": 24,
            "createdAt": "2025-03-17T00:00:00.000Z",
            "updatedAt": "2025-03-17T00:00:00.000Z"
        },
        "startDate": "2026-12-10",
        "endDate": "2026-12-12",
        "days": 3,
        "reason": "Family wedding out of town.",
        "status": {
            "value": "PENDING",
            "label": "Pending",
            "tone": "warning"
        },
        "reviewedBy": null,
        "reviewedAt": null,
        "isPending": true,
        "createdAt": "2026-11-26T00:00:00.000Z",
        "updatedAt": "2026-11-26T00:00:00.000Z",
        "capabilities": {
            "canApprove": true,
            "canReject": true,
            "canCancel": false
        }
    },
    {
        "id": "81193aa9-6c91-4491-a8a9-7f1674cb22d5",
        "userId": "DAdtBMwrhABnukKzl8zZcfEUDpykZeTk",
        "user": {
            "id": "DAdtBMwrhABnukKzl8zZcfEUDpykZeTk",
            "name": "Mitu Sen",
            "email": "mitu.sen2@pixelvega.com",
            "role": {
                "value": "DEVELOPER",
                "label": "Developer",
                "tone": "default"
            }
        },
        "leaveType": {
            "id": "be07e779-469e-4a5d-9d53-9d73d1023154",
            "name": "Unpaid Leave",
            "defaultDaysPerYear": 30,
            "createdAt": "2025-03-17T00:00:00.000Z",
            "updatedAt": "2025-03-17T00:00:00.000Z"
        },
        "startDate": "2026-11-29",
        "endDate": "2026-12-01",
        "days": 3,
        "reason": "Moving to a new flat this week.",
        "status": {
            "value": "PENDING",
            "label": "Pending",
            "tone": "warning"
        },
        "reviewedBy": null,
        "reviewedAt": null,
        "isPending": true,
        "createdAt": "2026-11-25T00:00:00.000Z",
        "updatedAt": "2026-11-25T00:00:00.000Z",
        "capabilities": {
            "canApprove": true,
            "canReject": true,
            "canCancel": false
        }
    }
] as unknown as LeaveRequest[];

export const AUDIT_ROWS = [
    {
        "id": "58e54283-7718-49c6-b034-c2d684ce4bba",
        "action": "user.deleted",
        "actionLabel": "User deleted",
        "targetType": "User",
        "targetId": "SfaYdqYdP6u7dVSurgqRyDBSaK8xdvGY",
        "metadata": {},
        "userId": "9gcxRVm1VDyVkWAD1VVJjvoC14IjYAEj",
        "user": {
            "id": "9gcxRVm1VDyVkWAD1VVJjvoC14IjYAEj",
            "name": "Rayhan Sheikh",
            "email": "rayhan.sheikh@pixelvega.com"
        },
        "createdAt": "2026-08-18T12:06:47.179Z"
    },
    {
        "id": "c7a2b7aa-0200-449f-be54-3cffbec67886",
        "action": "user.password_changed",
        "actionLabel": "User password changed",
        "targetType": "User",
        "targetId": "5o7F8iVBFDECjFrIIrZ3Er0vb0cme3DG",
        "metadata": {},
        "userId": "5o7F8iVBFDECjFrIIrZ3Er0vb0cme3DG",
        "user": {
            "id": "5o7F8iVBFDECjFrIIrZ3Er0vb0cme3DG",
            "name": "Imran Silva",
            "email": "imran.silva@pixelvega.com"
        },
        "createdAt": "2026-08-18T09:09:08.613Z"
    },
    {
        "id": "acd1a1ad-64a4-4ece-86d7-6e80a387959c",
        "action": "profile.updated",
        "actionLabel": "Profile updated",
        "targetType": "ClientProfile",
        "targetId": "lCb8fNKdBq5msC5HI5pqd6Wd6vzNjlVj",
        "metadata": {
            "fields": [
                "phone",
                "timezone"
            ]
        },
        "userId": "lCb8fNKdBq5msC5HI5pqd6Wd6vzNjlVj",
        "user": {
            "id": "lCb8fNKdBq5msC5HI5pqd6Wd6vzNjlVj",
            "name": "Tofael Jackson",
            "email": "tofael@vertex-consulting.com"
        },
        "createdAt": "2026-08-18T02:51:22.177Z"
    },
    {
        "id": "9982b554-bb75-43ad-bc33-78fd299181d6",
        "action": "user.updated",
        "actionLabel": "User updated",
        "targetType": "User",
        "targetId": "pXDFfS7kqMBmoNiX8YbgXDUS0FyBN7IY",
        "metadata": {
            "changes": {
                "status": {
                    "to": "ACTIVE",
                    "from": "INVITED"
                }
            }
        },
        "userId": "aVAIiHmPYdWkQjig20OqC3pPYlrszjaL",
        "user": {
            "id": "aVAIiHmPYdWkQjig20OqC3pPYlrszjaL",
            "name": "Daniel Ghosh",
            "email": "daniel.ghosh@pixelvega.com"
        },
        "createdAt": "2026-08-17T05:57:14.594Z"
    },
    {
        "id": "ee6c2b23-a1a5-451c-972e-210b9250c668",
        "action": "user.password_changed",
        "actionLabel": "User password changed",
        "targetType": "User",
        "targetId": "lCb8fNKdBq5msC5HI5pqd6Wd6vzNjlVj",
        "metadata": {},
        "userId": "lCb8fNKdBq5msC5HI5pqd6Wd6vzNjlVj",
        "user": {
            "id": "lCb8fNKdBq5msC5HI5pqd6Wd6vzNjlVj",
            "name": "Tofael Jackson",
            "email": "tofael@vertex-consulting.com"
        },
        "createdAt": "2026-08-16T15:06:41.938Z"
    },
    {
        "id": "14484083-c16e-42a7-90aa-a471c9825bb2",
        "action": "user.invited",
        "actionLabel": "User invited",
        "targetType": "User",
        "targetId": "MgPiSl6s2fi3F4wcu2AaSYnJXkUsL3b7",
        "metadata": {
            "role": "CLIENT",
            "email": "rasel@trailhead-solutions.com"
        },
        "userId": "uNfzPyFLbQwpkzTgkYUfxK5S7J5VO6Pt",
        "user": {
            "id": "uNfzPyFLbQwpkzTgkYUfxK5S7J5VO6Pt",
            "name": "Nusrat Silva",
            "email": "nusrat.silva@pixelvega.com"
        },
        "createdAt": "2026-08-16T08:58:58.010Z"
    }
] as unknown as AuditLogEntry[];
