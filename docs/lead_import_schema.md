# Lead Import Schema & Integration Guide

This document describes the schema requirements, CSV formats, and API endpoints for importing leads from external systems into the CRM system.

---

## 1. Import Endpoint Details

- **Endpoint**: `POST /api/leads/import`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <auth_token>`
- **Payload Structure**:
  ```json
  {
    "csv": "Full Name,Phone Number,Email Address,Lead Source...\n...",
    "mapping": {
      "name": "Full Name",
      "phone": "Phone Number",
      "email": "Email Address",
      "source": "Lead Source",
      "builder_name": "Builder Name",
      "possession_date": "Possession Date",
      "house_status": "House Status",
      "loan_approved": "Loan Approved (Yes/No)",
      "interior_style": "Interior Style",
      "material_preference": "Material Preference",
      "preferred_communication": "Preferred Comm.",
      "preferred_language": "Preferred Lang.",
      "dnc_flag": "DNC (Yes/No)",
      "consent_whatsapp": "WhatsApp Consent",
      "stageId": "Lead Stage ID",
      "assigneeId": "Assignee ID",
      "notes": "Notes"
    }
  }
  ```
  *(Note: If `mapping` is omitted, the API will automatically parse lowercase snake_case or standard headers: e.g. `phone`, `email`, `stageId`, `assigneeId`, etc.)*

---

## 2. Field Specifications & Validations

The following table details each of the 17 fields supported in the import workflow:

| # | Field Label (CSV Header) | CRM Target Key | Data Type | Required | Allowed Values / Validation Rules | Example Value |
|---|---|---|---|---|---|---|
| **1** | `Full Name` | `name` | String | **Yes** | Cannot be empty. Lead's primary identifier name. | `Rohan Sharma` |
| **2** | `Phone Number` | `phone` | String | **Yes** | Minimum 10 digits. Cleansed automatically of non-digit characters. Must be unique. | `+91 9876543210` |
| **3** | `Email Address` | `email` | String | No | Must be a valid email format. Must be unique if provided. | `rohan@example.com` |
| **4** | `Lead Source` | `source` | String | No | Allowed values configured in Tenant Settings. Default options: `Facebook`, `IndiaMART`, `Referral`, `Website`, `Direct`, `Other`. | `Facebook` |
| **5** | `Builder Name` | `builder_name` | String | No | Developer/Builder name of the property. | `Prestige Group` |
| **6** | `Possession Date` | `possession_date` | Date/String | No | ISO Date format `YYYY-MM-DD` or textual descriptions (e.g. `2026-12-01`). | `2024-12-01` |
| **7** | `House Status` | `house_status` | String | No | Allowed options: `Under Construction`, `Ready to Move`, `Renovation`. | `Under Construction` |
| **8** | `Loan Approved (Yes/No)` | `loan_approved`| Boolean | No | Case-insensitive: `Yes` / `No` / `True` / `False` / `1` / `0`. Defaults to `false`. | `Yes` |
| **9** | `Interior Style` | `interior_style` | String | No | Style choices (e.g., `Modern`, `Minimalist`, `Luxury`, `Traditional`). | `Modern` |
| **10** | `Material Preference` | `material_preference` | String | No | Construction / woodwork preferences (e.g., `Wood`, `MDF`, `Plywood`). | `Wood` |
| **11** | `Preferred Comm.` | `preferred_communication` | String | No | Preferred channel: `Call`, `WhatsApp`, `Email`, `SMS`. | `Call` |
| **12** | `Preferred Lang.` | `preferred_language` | String | No | Languages spoken (e.g. `English`, `Hindi`, `Telugu`, `Kannada`). | `English` |
| **13** | `DNC (Yes/No)` | `dnc_flag` | Boolean | No | Case-insensitive: `Yes` / `No` / `True` / `False`. Excludes lead from mass outreach campaigns. | `No` |
| **14** | `WhatsApp Consent` | `consent_whatsapp` | Boolean | No | Case-insensitive: `Yes` / `No` / `True` / `False`. Enables automated WhatsApp triggers. | `Yes` |
| **15** | `Lead Stage ID` | `stageId` | UUID | No | Must be a valid lead stage UUID for the current tenant. Defaults to the first pipeline stage if empty. | `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d` |
| **16** | `Assignee ID` | `assigneeId` | UUID | No | Must be a valid user UUID belonging to the CRM organization. | `33026725-b7ad-4560-bf81-b54199c089c1` |
| **17** | `Notes` | `notes` | String | No | Any additional contextual notes, conversation history, or scope details. | `Interested in 3BHK interior design starting next month.` |

---

## 3. Sample CSV Content

Below is a complete compliant sample row. You can download or export this template format:

```csv
Full Name,Phone Number,Email Address,Lead Source,Builder Name,Possession Date,House Status,Loan Approved (Yes/No),Interior Style,Material Preference,Preferred Comm.,Preferred Lang.,DNC (Yes/No),WhatsApp Consent,Lead Stage ID,Assignee ID,Notes
Rohan Sharma,+91 9876543210,rohan@example.com,Facebook,Prestige Group,2024-12-01,Under Construction,Yes,Modern,Wood,Call,English,No,Yes,,,Interested in 3BHK interior design starting next month.
```

---

## 4. API Success & Error Response Samples

### Success Response (Status 200)

When all rows (or partially successful rows) are processed, the system returns a breakdown:

```json
{
  "success": true,
  "data": {
    "created": 1,
    "skipped": 0,
    "errors": []
  }
}
```

### Validation Failure / Duplicate Error Response (Status 400/409)

If crucial validations fail (such as a duplicate phone/email or format violation), details about the specific failed row are returned in the errors array:

```json
{
  "success": false,
  "error": {
    "message": "Validation errors or duplicates found",
    "details": [
      {
        "row": 2,
        "error": "A lead with this phone, email, or identical name and address already exists"
      }
    ]
  }
}
```
