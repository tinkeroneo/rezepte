# Supabase RLS Audit

Diese App nutzt **Spaces**. Ziel: Jede Zeile ist genau einem `space_id` zugeordnet und nur Mitglieder dieses Spaces dürfen darauf zugreifen.

## 1) Schnellcheck: RLS ist aktiv?

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'recipes', 'recipe_parts', 'spaces', 'user_spaces',
    'cook_events', 'client_logs', 'space_invites'
  );
```

Für alle relevanten Tabellen sollte `rowsecurity = true` sein.

## 2) Policies anwenden

Für **cook_events** und **client_logs** liegt eine Baseline hier:

- `SUPABASE_RLS_AUDIT.sql`

Für **Invites**: `SUPABASE_SHARING.sql`.

## 3) Storage Uploads

Die App lädt Bilder über eine Edge Function hoch, damit:

1) CORS sauber ist (cook.tinkeroneo.de + localhost),
2) der Upload-Pfad **space-basiert** ist (z.B. `${space_id}/...`).

Wenn du zusätzlich Android/Capacitor nutzt, sind typische Origins:

- `capacitor://localhost`
- `ionic://localhost`

Diese müssen dann in der Edge Function in `allowedOrigins` ergänzt werden.

## 4) Minimaler Debug-Query (wenn 403 kommt)

```sql
-- Prüfe, ob du im Space wirklich Mitglied bist
select *
from public.user_spaces
where user_id = auth.uid();
```

Wenn der Space fehlt, muss beim ersten Login ein Default-Space erstellt/zugewiesen werden.
