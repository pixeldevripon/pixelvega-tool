import type { Project } from '@/types/projects';

/**
 * Six real rows from `GET /projects`, captured against the seeded database on
 * 2026-08-20 and trimmed to the fields the three views read.
 *
 * Captured rather than hand written on purpose. A hand written fixture agrees
 * with whatever the author believed the API sends, which is how a view ends up
 * reading a field that does not exist: `progressPercentage` and `lastWorkedAt`
 * were both invented that way in this codebase. This one disagrees with the
 * types if the API ever does.
 *
 * The seeded data has no project without a deadline, without a planned start or
 * without a lead, and all three are states the API really produces, so the
 * specs synthesise those from these rows instead of pretending they cannot
 * happen.
 */
export const PROJECT_ROWS = [
    {
        "id": "68a526c7-d0b1-40b5-b443-0a321c42301c",
        "name": "Copperfield Partners Intranet",
        "status": {
            "value": "ON_HOLD",
            "label": "On hold",
            "tone": "warning"
        },
        "priority": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "projectTypeTags": [
            {
                "id": "ceb2e02b-560e-4126-ad57-53e162b96f39",
                "projectId": "68a526c7-d0b1-40b5-b443-0a321c42301c",
                "type": {
                    "value": "WIX",
                    "label": "Wix",
                    "tone": "default"
                },
                "createdAt": "2025-07-08T07:46:43.439Z"
            },
            {
                "id": "40e6d5e3-7020-4b24-94b1-91423e48cc42",
                "projectId": "68a526c7-d0b1-40b5-b443-0a321c42301c",
                "type": {
                    "value": "WEBFLOW",
                    "label": "Webflow",
                    "tone": "default"
                },
                "createdAt": "2025-07-08T07:46:43.439Z"
            }
        ],
        "plannedStartDate": "2025-07-21T07:46:43.439Z",
        "deadline": "2025-09-07T07:46:43.439Z",
        "daysUntilDeadline": -347,
        "deadlineLabel": "347 days overdue",
        "isOverdue": true,
        "isTerminal": false,
        "estimatedHours": 353.4,
        "actualHours": 25.55,
        "remainingHours": 327.84999999999997,
        "actualHoursLabel": "25h 33m",
        "estimatedHoursLabel": "353h 24m",
        "remainingHoursLabel": "327h 51m",
        "members": [
            {
                "id": "yDwJBNznehooWVoJQXuToNoB5QUHRIQ5",
                "name": "Muntasir Smith",
                "avatarUrl": null,
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "tPThRGmHTjFUiA1F7bjlLi8V1MLTltn4",
                "name": "Jabed Mia",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/jabed-mia-cf76ce.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "3N3zk6WHrwbj7Fl8tZjGJPWy5Q4J3TBa",
                "name": "Nina Muller",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/nina-muller-b2242d.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            }
        ],
        "lead": {
            "id": "yDwJBNznehooWVoJQXuToNoB5QUHRIQ5",
            "name": "Muntasir Smith",
            "avatarUrl": null,
            "projectRole": {
                "value": "PROJECT_MANAGER",
                "label": "Project manager",
                "tone": "default"
            }
        },
        "capabilities": {
            "canEdit": false,
            "canChangeStatus": false,
            "canChangePriority": false,
            "canManageTypes": false,
            "canManageEstimatedHours": false,
            "canArchive": false,
            "canRestore": false,
            "canConnectSlack": false,
            "canManageMembers": false,
            "canManageDocuments": false
        }
    },
    {
        "id": "d4830e03-87e4-4e1e-a2e1-18db85eea154",
        "name": "Riverstone Partners Intranet",
        "status": {
            "value": "INTERNAL_REVIEW",
            "label": "Internal review",
            "tone": "default"
        },
        "priority": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "projectTypeTags": [
            {
                "id": "41d038b2-f964-40f4-81d8-c3e52df88f96",
                "projectId": "d4830e03-87e4-4e1e-a2e1-18db85eea154",
                "type": {
                    "value": "WEBFLOW",
                    "label": "Webflow",
                    "tone": "default"
                },
                "createdAt": "2025-07-27T21:51:29.309Z"
            },
            {
                "id": "099d7ada-820a-4320-9de2-e34d8aa20f30",
                "projectId": "d4830e03-87e4-4e1e-a2e1-18db85eea154",
                "type": {
                    "value": "WORDPRESS",
                    "label": "WordPress",
                    "tone": "default"
                },
                "createdAt": "2025-07-27T21:51:29.309Z"
            },
            {
                "id": "5b47c8c3-738a-42c5-b1ff-5c9ee2183d89",
                "projectId": "d4830e03-87e4-4e1e-a2e1-18db85eea154",
                "type": {
                    "value": "MERN_STACK",
                    "label": "MERN stack",
                    "tone": "default"
                },
                "createdAt": "2025-07-27T21:51:29.309Z"
            }
        ],
        "plannedStartDate": "2025-08-07T21:51:29.309Z",
        "deadline": "2025-09-10T21:51:29.309Z",
        "daysUntilDeadline": -344,
        "deadlineLabel": "344 days overdue",
        "isOverdue": true,
        "isTerminal": false,
        "estimatedHours": 119.2,
        "actualHours": 21.5,
        "remainingHours": 97.7,
        "actualHoursLabel": "21h 30m",
        "estimatedHoursLabel": "119h 12m",
        "remainingHoursLabel": "97h 42m",
        "members": [
            {
                "id": "prpTGOJXJRheGxxqhm4bvqevuhz1LN2c",
                "name": "Anna Johnson",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/anna-johnson-fd03b1.jpg",
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "QgMtl2gaND6aiXnzHgC8NGY59l5SAsSl",
                "name": "Shohag Talukder",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/shohag-talukder-ffb137.jpg",
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "5FxrtahHc4BoLnejCenP9jQaJM1V4bA5",
                "name": "Emma Johnson",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/emma-johnson-533bf7.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "mOQaXqMqXXTCZCE7xkzoXEkKAmi0C641",
                "name": "Sneha Alam",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "jcPfmHlwzBZsFa1wdyqUBjNCkuNvtDbx",
                "name": "Tania Anderson",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "3tnzHnrhW0OxonFuit8NHIHlhVYXaPG4",
                "name": "Kamrul Parvin",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/kamrul-parvin-bdc4a2.jpg",
                "projectRole": {
                    "value": "DESIGNER",
                    "label": "Designer",
                    "tone": "default"
                }
            }
        ],
        "lead": {
            "id": "prpTGOJXJRheGxxqhm4bvqevuhz1LN2c",
            "name": "Anna Johnson",
            "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/anna-johnson-fd03b1.jpg",
            "projectRole": {
                "value": "PROJECT_MANAGER",
                "label": "Project manager",
                "tone": "default"
            }
        },
        "capabilities": {
            "canEdit": false,
            "canChangeStatus": false,
            "canChangePriority": false,
            "canManageTypes": false,
            "canManageEstimatedHours": false,
            "canArchive": false,
            "canRestore": false,
            "canConnectSlack": false,
            "canManageMembers": false,
            "canManageDocuments": false
        }
    },
    {
        "id": "538178ce-c536-4eb1-bdf8-d23a8f155bda",
        "name": "Silverline Brands Brand Refresh",
        "status": {
            "value": "ON_HOLD",
            "label": "On hold",
            "tone": "warning"
        },
        "priority": {
            "value": "MEDIUM",
            "label": "Medium",
            "tone": "primary"
        },
        "projectTypeTags": [
            {
                "id": "389a4eb2-2fef-4381-bb82-410eca178272",
                "projectId": "538178ce-c536-4eb1-bdf8-d23a8f155bda",
                "type": {
                    "value": "SEO",
                    "label": "SEO",
                    "tone": "default"
                },
                "createdAt": "2025-08-21T06:11:44.143Z"
            }
        ],
        "plannedStartDate": "2025-08-31T06:11:44.143Z",
        "deadline": "2025-10-07T06:11:44.143Z",
        "daysUntilDeadline": -317,
        "deadlineLabel": "317 days overdue",
        "isOverdue": true,
        "isTerminal": false,
        "estimatedHours": null,
        "actualHours": 17.55,
        "remainingHours": null,
        "actualHoursLabel": "17h 33m",
        "estimatedHoursLabel": null,
        "remainingHoursLabel": null,
        "members": [
            {
                "id": "QcXS2TQ964LkQz81yU0cJGWYX9aYNO9Y",
                "name": "Elena Mahmud",
                "avatarUrl": null,
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "Ed6ArKnZnTVHyrB7vmSKsIoXqA3e8YCo",
                "name": "Chen Nakamura",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/chen-nakamura-e7cdee.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "3so3RZebrH68bstQhjNuDzo63hStjso2",
                "name": "Nusrat Novak",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "pXWZ8JeVyMSakjzLd3CwatX0eb5JlVqk",
                "name": "Mateo Moore",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/mateo-moore-65b123.jpg",
                "projectRole": {
                    "value": "DESIGNER",
                    "label": "Designer",
                    "tone": "default"
                }
            }
        ],
        "lead": {
            "id": "QcXS2TQ964LkQz81yU0cJGWYX9aYNO9Y",
            "name": "Elena Mahmud",
            "avatarUrl": null,
            "projectRole": {
                "value": "PROJECT_MANAGER",
                "label": "Project manager",
                "tone": "default"
            }
        },
        "capabilities": {
            "canEdit": false,
            "canChangeStatus": false,
            "canChangePriority": false,
            "canManageTypes": false,
            "canManageEstimatedHours": false,
            "canArchive": false,
            "canRestore": false,
            "canConnectSlack": false,
            "canManageMembers": false,
            "canManageDocuments": false
        }
    },
    {
        "id": "698bbcf2-448e-415a-b381-b3067758b709",
        "name": "Test Client Company Support Center",
        "status": {
            "value": "WAITING_FOR_FEEDBACK",
            "label": "Waiting for feedback",
            "tone": "warning"
        },
        "priority": {
            "value": "LOW",
            "label": "Low",
            "tone": "default"
        },
        "projectTypeTags": [
            {
                "id": "8faa4967-307f-4825-8688-46545123c339",
                "projectId": "698bbcf2-448e-415a-b381-b3067758b709",
                "type": {
                    "value": "SEO",
                    "label": "SEO",
                    "tone": "default"
                },
                "createdAt": "2025-08-13T06:35:10.787Z"
            },
            {
                "id": "dc8636cb-2560-4615-8771-7f7d103adcfa",
                "projectId": "698bbcf2-448e-415a-b381-b3067758b709",
                "type": {
                    "value": "FRAMER",
                    "label": "Framer",
                    "tone": "default"
                },
                "createdAt": "2025-08-13T06:35:10.787Z"
            }
        ],
        "plannedStartDate": "2025-09-02T06:35:10.787Z",
        "deadline": "2025-10-14T06:35:10.787Z",
        "daysUntilDeadline": -310,
        "deadlineLabel": "310 days overdue",
        "isOverdue": true,
        "isTerminal": false,
        "estimatedHours": 66.4,
        "actualHours": 75.23333333333333,
        "remainingHours": -8.833333333333329,
        "actualHoursLabel": "75h 14m",
        "estimatedHoursLabel": "66h 24m",
        "remainingHoursLabel": "-8h 50m",
        "members": [
            {
                "id": "3OIigS1u8rYHj5lHRriNv8eKGFMaEuZo",
                "name": "Test Project Manager",
                "avatarUrl": null,
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "oUzuZquvedHVd7DKyC5PNPP6epvPT5lH",
                "name": "Asif Davis",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "kRJ8aMxUF4tGVq2UNixsXm9QdlOhLN4S",
                "name": "Isabella Akter",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "9PRGWjOPVzROxs52BGoVzswg3a59clCX",
                "name": "Naimul Nakamura",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/naimul-nakamura-e5d5f2.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "HXQVvfcJX6zJOo8pymJV5zN21tVeapZq",
                "name": "Test Developer",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "okxy0odzhC1lP6GXTPxn0fge7nwuY5KM",
                "name": "Farhan Bhuiyan",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/farhan-bhuiyan-83989f.jpg",
                "projectRole": {
                    "value": "DESIGNER",
                    "label": "Designer",
                    "tone": "default"
                }
            },
            {
                "id": "nm0JXVfcKw0LvyfWT6eimalQkcw0I1Tk",
                "name": "Test Designer",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DESIGNER",
                    "label": "Designer",
                    "tone": "default"
                }
            }
        ],
        "lead": {
            "id": "3OIigS1u8rYHj5lHRriNv8eKGFMaEuZo",
            "name": "Test Project Manager",
            "avatarUrl": null,
            "projectRole": {
                "value": "PROJECT_MANAGER",
                "label": "Project manager",
                "tone": "default"
            }
        },
        "capabilities": {
            "canEdit": true,
            "canChangeStatus": true,
            "canChangePriority": true,
            "canManageTypes": true,
            "canManageEstimatedHours": true,
            "canArchive": false,
            "canRestore": false,
            "canConnectSlack": true,
            "canManageMembers": true,
            "canManageDocuments": true
        }
    },
    {
        "id": "b8b7f7eb-dc31-443e-a384-61e9a2189b9c",
        "name": "Lumen Partners Event Microsite",
        "status": {
            "value": "CANCELLED",
            "label": "Cancelled",
            "tone": "danger"
        },
        "priority": {
            "value": "HIGH",
            "label": "High",
            "tone": "warning"
        },
        "projectTypeTags": [
            {
                "id": "e98fb2a1-d5e4-4286-a266-5ad3558fee63",
                "projectId": "b8b7f7eb-dc31-443e-a384-61e9a2189b9c",
                "type": {
                    "value": "WORDPRESS",
                    "label": "WordPress",
                    "tone": "default"
                },
                "createdAt": "2025-07-07T11:40:51.022Z"
            },
            {
                "id": "d4bd1dd9-4ff6-4737-b148-a80371c48d36",
                "projectId": "b8b7f7eb-dc31-443e-a384-61e9a2189b9c",
                "type": {
                    "value": "SEO",
                    "label": "SEO",
                    "tone": "default"
                },
                "createdAt": "2025-07-07T11:40:51.022Z"
            }
        ],
        "plannedStartDate": "2025-07-11T11:40:51.022Z",
        "deadline": "2025-11-01T11:40:51.022Z",
        "daysUntilDeadline": -292,
        "deadlineLabel": "292 days overdue",
        "isOverdue": false,
        "isTerminal": true,
        "estimatedHours": 408.2,
        "actualHours": 13.4,
        "remainingHours": 394.8,
        "actualHoursLabel": "13h 24m",
        "estimatedHoursLabel": "408h 12m",
        "remainingHoursLabel": "394h 48m",
        "members": [
            {
                "id": "MbzQo92398NkIB09co437NQcMEBRJPQF",
                "name": "Asif Johnson",
                "avatarUrl": null,
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "TpAtWlJTfVNHKlDd2wn4Sev2H0KGOqXi",
                "name": "Imran Muller",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/imran-muller-000587.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "26AVane4dfAmztD9kZM0FMAxjqv2ASOX",
                "name": "Mei Rahman",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/mei-rahman-4c7df1.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            }
        ],
        "lead": {
            "id": "MbzQo92398NkIB09co437NQcMEBRJPQF",
            "name": "Asif Johnson",
            "avatarUrl": null,
            "projectRole": {
                "value": "PROJECT_MANAGER",
                "label": "Project manager",
                "tone": "default"
            }
        },
        "capabilities": {
            "canEdit": false,
            "canChangeStatus": false,
            "canChangePriority": false,
            "canManageTypes": false,
            "canManageEstimatedHours": false,
            "canArchive": false,
            "canRestore": false,
            "canConnectSlack": false,
            "canManageMembers": false,
            "canManageDocuments": false
        }
    },
    {
        "id": "bdfe61ab-ce57-4d64-adc1-71c6a2a9ff24",
        "name": "Goldleaf Group Event Microsite",
        "status": {
            "value": "READY_FOR_WORK",
            "label": "Ready for work",
            "tone": "primary"
        },
        "priority": {
            "value": "CRITICAL",
            "label": "Critical",
            "tone": "danger"
        },
        "projectTypeTags": [
            {
                "id": "c10cc098-4b17-4756-b65c-2e7f2f25ad31",
                "projectId": "bdfe61ab-ce57-4d64-adc1-71c6a2a9ff24",
                "type": {
                    "value": "WORDPRESS",
                    "label": "WordPress",
                    "tone": "default"
                },
                "createdAt": "2025-08-16T17:04:46.551Z"
            }
        ],
        "plannedStartDate": "2025-08-19T17:04:46.551Z",
        "deadline": "2025-11-01T17:04:46.551Z",
        "daysUntilDeadline": -292,
        "deadlineLabel": "292 days overdue",
        "isOverdue": true,
        "isTerminal": false,
        "estimatedHours": 3.7,
        "actualHours": 46.8,
        "remainingHours": -43.099999999999994,
        "actualHoursLabel": "46h 48m",
        "estimatedHoursLabel": "3h 42m",
        "remainingHoursLabel": "-43h 6m",
        "members": [
            {
                "id": "3OIigS1u8rYHj5lHRriNv8eKGFMaEuZo",
                "name": "Test Project Manager",
                "avatarUrl": null,
                "projectRole": {
                    "value": "PROJECT_MANAGER",
                    "label": "Project manager",
                    "tone": "default"
                }
            },
            {
                "id": "OEs2rSiwfYonXp55p0p4ovWa2LlUy3YL",
                "name": "Anna Johnson",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "ADxEAsfXYBTy8nfZeDiidmeZuyA1mWa4",
                "name": "Jannat Thomas",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "y5sdBAzatFBAYft6Q2xrLd4YM4QBrJKi",
                "name": "Tofael Mia",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/tofael-mia-7978d9.jpg",
                "projectRole": {
                    "value": "DEVELOPER",
                    "label": "Developer",
                    "tone": "default"
                }
            },
            {
                "id": "4vG843th96479DHho8964Gj6DBR5Hc3j",
                "name": "Jannat Jahan",
                "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars/jannat-jahan-8ec3d6.jpg",
                "projectRole": {
                    "value": "DESIGNER",
                    "label": "Designer",
                    "tone": "default"
                }
            },
            {
                "id": "319Jzgx617hdEVe0ifNvld5u7dcBCJf6",
                "name": "Pavel Saha",
                "avatarUrl": null,
                "projectRole": {
                    "value": "DESIGNER",
                    "label": "Designer",
                    "tone": "default"
                }
            }
        ],
        "lead": {
            "id": "3OIigS1u8rYHj5lHRriNv8eKGFMaEuZo",
            "name": "Test Project Manager",
            "avatarUrl": null,
            "projectRole": {
                "value": "PROJECT_MANAGER",
                "label": "Project manager",
                "tone": "default"
            }
        },
        "capabilities": {
            "canEdit": true,
            "canChangeStatus": true,
            "canChangePriority": true,
            "canManageTypes": true,
            "canManageEstimatedHours": true,
            "canArchive": false,
            "canRestore": false,
            "canConnectSlack": true,
            "canManageMembers": true,
            "canManageDocuments": true
        }
    }
] as unknown as Project[];
