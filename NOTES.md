# Timeflow Web   

## 
: Next.js (Turbopack).  :    ,    Flutter-, , ,   , MariaDB, Firebase.

##  ,  
1.  - BOM/ UTF-8 ("Unexpected token '?'"  package.json / CSS).   BOM   .next. : IDEA   UTF-8.
2. Turbopack       .next   dev-.
3.  parsing errors -   "\r\n"        UTF-8.
4.  "Module not found: firebase-admin"   /   env.

##   (admin chat)  MariaDB
-  WebSocket  (server/ws-server.mjs), MariaDB , API  .
- , , typing, read receipts.
-  :
  - project_admin_chat
  - project_admin_chat_reactions
  - project_admin_chat_pins
  - project_admin_chat_reads
- API:
  - app/api/admin-chat/route.ts
  - app/api/admin-chat/reactions/route.ts
  - app/api/admin-chat/pins/route.ts
  - app/api/admin-chat/typing/route.ts
- :    Firebase  API .

##  (Reports)
: app/app/reports/page.tsx

:
-     UTF-8,   .
-   :
  -   > PDF   
  -   > PDF   
  -  +  >      
  -   >  
-  : collectionGroup("months") +  projectId/month.
- PDF    :
  -  
  -  
  -  "   "
  -    
  - KPI: ""  " "
  -  ""  "" (   )
  -   TIMEFLOW
- CSV     .

:
-    parsing -  "\r\n"        .

##  (Settings)
: app/app/settings/page.tsx

:
-   "" ,    .
-    MariaDB  /api/settings.
-  :
  - company_name
  - timezone
  - currency
  - language
  - max_shift_hours
  - min_break_minutes
  - confirm_hours
  - overtime_policy
  - email_sender
  - copy_lead
  - slack_channel
  - telegram_channel

## API 
: app/api/settings/route.ts

- GET /api/settings     MariaDB.
- POST /api/settings  /   MariaDB.
- : Firebase token (Bearer).

## MariaDB schema
: db/schema.sql

 :
app_settings
- user_id (PK)
- company_name, timezone, currency, language
- max_shift_hours, min_break_minutes, confirm_hours, overtime_policy
- email_sender, copy_lead, slack_channel, telegram_channel
- created_at, updated_at

:   SQL  db/schema.sql.

## 
-  IDEA  UTF-8    .
-     UTF-8.

##      ()
1. Project page:
   -  HoursTab (       ).
   -  users_public  .
2. Overview:
   -  ,  , , .
3. :
   -   ,   .

## ,  
-  : Remove-Item -Recurse -Force .next
-  BOM: byte[]  .
-    UTF-8  PowerShell.

##   
1. /app/reports   ,  PDF.
2. /app/settings     MariaDB.
3. /api/settings   GET/POST  .

##   ()
1.   PDF "  " (  Flutter).
2.  /,  .
3.     MariaDB.
4.      .
