# FB Pulse Tracker - Use Case Diagram

## Diagram

```mermaid
graph TB
    subgraph "External Actors"
        Viewer["👤 Viewer"]
        Admin["👤 Admin"]
        Gemini["🤖 Google Gemini API"]
        Firebase["🔐 Firebase Authentication"]
    end

    subgraph "FB Pulse Tracker System"
        subgraph "Authentication"
            UC_LOGIN["Login"]
            UC_LOGOUT["Logout"]
            UC_AUTH["Authenticate User"]
            UC_VALIDATE["Validate User Access"]
        end

        subgraph "Data Import"
            UC_IMPORT_ZIP["Import Facebook ZIP"]
            UC_VIEW_IMPORTS["View Imported Data"]
            UC_PROCESS_ZIP["Process Facebook ZIP"]
            UC_EXTRACT_COMMENTS["Extract Comments"]
            UC_EXTRACT_REACTIONS["Extract Reactions"]
        end

        subgraph "Comment Management"
            UC_VIEW_COMMENTS["View Comments"]
            UC_SEARCH["Search Comments"]
        end

        subgraph "Analytics"
            UC_SENTIMENT["View Sentiment Analytics"]
            UC_INTENT["View Intent Analytics"]
            UC_FILTER["Filter Analytics Data"]
            UC_REPORTS["View Campaign Reports"]
            UC_ANALYZE_SENTIMENT["Analyze Sentiment"]
            UC_ANALYZE_INTENT["Analyze Intent"]
            UC_SUMMARY["Generate Analytics Summary"]
            UC_GENERATE_REPORT["Generate Report"]
            UC_FALLBACK["Fallback Rule-Based Analysis"]
        end

        subgraph "Export"
            UC_EXPORT_CSV["Export CSV"]
            UC_EXPORT_JSON["Export JSON"]
            UC_EXPORT_XLSX["Export XLSX"]
        end

        subgraph "Dashboard"
            UC_DASHBOARD["View Dashboard"]
        end

        subgraph "Seeding Management (Admin)"
            UC_CREATE_CAMPAIGN["Create Seeding Campaign"]
            UC_UPDATE_CAMPAIGN["Update Seeding Campaign"]
            UC_DELETE_CAMPAIGN["Delete Seeding Campaign"]
            UC_SEEDING_PERF["View Seeding Performance"]
            UC_AI_IDEAS["Generate AI Content Ideas"]
        end

        subgraph "Administration (Admin)"
            UC_MANAGE_ACCOUNTS["Manage Accounts"]
            UC_APPROVE["Approve User Access"]
            UC_REVOKE["Revoke User Access"]
            UC_SETTINGS["Manage System Settings"]
            UC_AI_CONFIG["Manage AI Configuration"]
            UC_AUDIT["View Audit Logs"]
        end
    end

    %% Viewer Associations
    Viewer --> UC_LOGIN
    Viewer --> UC_LOGOUT
    Viewer --> UC_DASHBOARD
    Viewer --> UC_IMPORT_ZIP
    Viewer --> UC_VIEW_IMPORTS
    Viewer --> UC_VIEW_COMMENTS
    Viewer --> UC_SEARCH
    Viewer --> UC_SENTIMENT
    Viewer --> UC_INTENT
    Viewer --> UC_FILTER
    Viewer --> UC_REPORTS
    Viewer --> UC_EXPORT_CSV
    Viewer --> UC_EXPORT_JSON
    Viewer --> UC_EXPORT_XLSX

    %% Admin Associations (inherits all Viewer + extra)
    Admin --> UC_LOGIN
    Admin --> UC_LOGOUT
    Admin --> UC_DASHBOARD
    Admin --> UC_MANAGE_ACCOUNTS
    Admin --> UC_APPROVE
    Admin --> UC_REVOKE
    Admin --> UC_CREATE_CAMPAIGN
    Admin --> UC_UPDATE_CAMPAIGN
    Admin --> UC_DELETE_CAMPAIGN
    Admin --> UC_SEEDING_PERF
    Admin --> UC_AI_IDEAS
    Admin --> UC_SETTINGS
    Admin --> UC_AI_CONFIG
    Admin --> UC_AUDIT
    Admin --> UC_IMPORT_ZIP
    Admin --> UC_VIEW_IMPORTS
    Admin --> UC_VIEW_COMMENTS
    Admin --> UC_SEARCH
    Admin --> UC_SENTIMENT
    Admin --> UC_INTENT
    Admin --> UC_FILTER
    Admin --> UC_REPORTS
    Admin --> UC_EXPORT_CSV
    Admin --> UC_EXPORT_JSON
    Admin --> UC_EXPORT_XLSX

    %% External System Associations
    Gemini --> UC_ANALYZE_SENTIMENT
    Gemini --> UC_ANALYZE_INTENT
    Gemini --> UC_AI_IDEAS
    Firebase --> UC_AUTH

    %% Include Relationships
    UC_LOGIN ..> UC_AUTH : <<include>>
    UC_LOGIN ..> UC_VALIDATE : <<include>>
    UC_IMPORT_ZIP ..> UC_PROCESS_ZIP : <<include>>
    UC_PROCESS_ZIP ..> UC_EXTRACT_COMMENTS : <<include>>
    UC_PROCESS_ZIP ..> UC_EXTRACT_REACTIONS : <<include>>
    UC_SENTIMENT ..> UC_ANALYZE_SENTIMENT : <<include>>
    UC_INTENT ..> UC_ANALYZE_INTENT : <<include>>
    UC_REPORTS ..> UC_GENERATE_REPORT : <<include>>
    UC_GENERATE_REPORT ..> UC_SUMMARY : <<include>>
    UC_CREATE_CAMPAIGN ..> UC_AI_IDEAS : <<include>>

    %% Extend Relationships
    UC_ANALYZE_SENTIMENT ..> UC_FALLBACK : <<extend>>
    UC_ANALYZE_INTENT ..> UC_FALLBACK : <<extend>>

    %% Generalization
    Admin -.->|<<extends>>| Viewer

    %% Styling
    classDef actor fill:#3498DB,stroke:#2C3E50,color:#fff
    classDef usecase fill:#fff,stroke:#2C3E50
    classDef include stroke:#27AE60,stroke-width:2px
    classDef extend stroke:#E74C3C,stroke-width:2px
    classDef internal fill:#ECF0F1,stroke:#BDC3C7,stroke-dasharray:5

    class Viewer,Admin actor
    class Gemini,Firebase actor
    class UC_LOGIN,UC_LOGOUT,UC_AUTH,UC_VALIDATE usecase
    class UC_IMPORT_ZIP,UC_VIEW_IMPORTS,UC_PROCESS_ZIP,UC_EXTRACT_COMMENTS,UC_EXTRACT_REACTIONS usecase
    class UC_VIEW_COMMENTS,UC_SEARCH usecase
    class UC_SENTIMENT,UC_INTENT,UC_FILTER,UC_REPORTS,UC_ANALYZE_SENTIMENT,UC_ANALYZE_INTENT,UC_SUMMARY,UC_GENERATE_REPORT usecase
    class UC_EXPORT_CSV,UC_EXPORT_JSON,UC_EXPORT_XLSX usecase
    class UC_DASHBOARD usecase
    class UC_CREATE_CAMPAIGN,UC_UPDATE_CAMPAIGN,UC_DELETE_CAMPAIGN,UC_SEEDING_PERF,UC_AI_IDEAS usecase
    class UC_MANAGE_ACCOUNTS,UC_APPROVE,UC_REVOKE,UC_SETTINGS,UC_AI_CONFIG,UC_AUDIT usecase
    class UC_FALLBACK internal
```

## Legend

| Symbol | Meaning |
|--------|---------|
| 👤 Actor | External User or System |
| 👤➡️ | User performs action |
| <<include>> | Mandatory sub-function |
| <<extend>> | Optional extension |
| <<extends>> | Inheritance (Admin inherits Viewer) |

## Actors Description

| Actor | Type | Description |
|-------|------|-------------|
| **Viewer** | Human | Authorized user with read-only access |
| **Admin** | Human | Full system administrator (inherits Viewer) |
| **Google Gemini API** | External System | AI service for sentiment/intent analysis |
| **Firebase Authentication** | External System | Authentication provider |

## Use Cases Summary

### Authentication (All Users)
- **Login**: Authenticate via Firebase, validate access
- **Logout**: End user session

### Data Import (All Users)
- **Import Facebook ZIP**: Upload ZIP export from Facebook
- **View Imported Data**: Browse uploaded data files

### Comment Management (All Users)
- **View Comments**: Display comments with sentiment/intent tags
- **Search Comments**: Full-text search across comments

### Analytics (All Users)
- **View Sentiment Analytics**: Charts showing positive/negative/neutral distribution
- **View Intent Analytics**: Charts showing user intent categories
- **Filter Analytics Data**: Apply date range, sentiment, intent filters
- **View Campaign Reports**: Generate and view seeding campaign reports

### Export (All Users)
- **Export CSV**: Export data to CSV format
- **Export JSON**: Export data to JSON format
- **Export XLSX**: Export data to Excel format

### Dashboard (All Users)
- **View Dashboard**: Overview with key metrics and charts

### Seeding Management (Admin Only)
- **Create Seeding Campaign**: Create new seeding campaign
- **Update Seeding Campaign**: Modify existing campaign
- **Delete Seeding Campaign**: Remove campaign
- **View Seeding Performance**: Monitor seeding effectiveness
- **Generate AI Content Ideas**: Use AI to generate content ideas

### Administration (Admin Only)
- **Manage Accounts**: CRUD operations on user accounts
- **Approve User Access**: Add user to whitelist
- **Revoke User Access**: Remove user from whitelist
- **Manage System Settings**: Configure system parameters
- **Manage AI Configuration**: Configure AI service settings
- **View Audit Logs**: View system activity logs

## Relationships

### Include (Mandatory)
```
Login → Authenticate User
Login → Validate User Access
Import Facebook ZIP → Process Facebook ZIP
Process Facebook ZIP → Extract Comments
Process Facebook ZIP → Extract Reactions
View Sentiment Analytics → Analyze Sentiment
View Intent Analytics → Analyze Intent
View Campaign Reports → Generate Report
Generate Report → Generate Analytics Summary
Create Seeding Campaign → Generate AI Content Ideas
```

### Extend (Optional)
```
Analyze Sentiment → Fallback Rule-Based Analysis
Analyze Intent → Fallback Rule-Based Analysis
```

### Generalization
```
Admin extends Viewer (Admin inherits all Viewer permissions)
```

## Internal System Use Cases

| Use Case | Description |
|----------|-------------|
| Process Facebook ZIP | Parse ZIP structure, identify file types |
| Extract Comments | Parse HTML/JSON comment files |
| Extract Reactions | Parse reaction data from ZIP |
| Analyze Sentiment | AI-based sentiment classification |
| Analyze Intent | AI-based intent classification |
| Generate Analytics Summary | Aggregate statistics |
| Generate Report | Compile report data |
| Validate User Access | Check whitelist membership |
| Authenticate User | Firebase authentication |
| Fallback Rule-Based Analysis | Rule-based fallback when AI fails |
