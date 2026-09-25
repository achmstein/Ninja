# Monitoring

One server, one owner. The whole budget is: is it up, did the deploy work, is there a backup. No dashboards.

## Health

Every API answers `/health` in every environment: one word, `Healthy`, `Degraded` or `Unhealthy`, and an HTTP 200 only when every check passes. The checks are the ones the Aspire client integrations register for the service: its database, the event bus, and "self". `/alive` answers on "self" alone.

The BFF exposes each one on the public edge as `https://api.chillax.site/health/<service>`:

```
catalog ordering spaces sales inventory payroll finance identity loyalty notification accounts tenant
```

Try one: `curl -i https://api.chillax.site/health/sales`.

## After a deploy

`deploy.yml` ends with a smoke step: every `/health/<service>` (up to three minutes each, since services migrate on start), the four web apps and the Keycloak realm must answer 200, or the run fails. A red deploy run means the site is not right; read the step's output for which URL and what it answered.

## Between deploys

`uptime.yml` probes the same URLs every 15 minutes from GitHub's runners. A failed run is the alert: GitHub e-mails the repository owner on the first failure of a workflow, and again when it recovers. Nothing to sign up for.

The nightly backup is checked the same way by `backup.yml` (see `restore.md`).

## When something is red

1. Which URL failed, and what did it answer? `none` means Caddy or the VM is unreachable; `502`/`503` means Caddy is up but the BFF or the service behind it is not; `503` on a `/health/<service>` with the rest green means that service's database or bus connection is down.
2. On the server: `cd /opt/chillax && docker compose -f docker-compose.yaml -f docker-compose.caddy.yml ps` shows what is running; `docker logs --tail 200 chillax-<service>-1` shows why not.
3. After a reboot every container should come back on its own (`restart: unless-stopped` is forced onto the infrastructure services by `deploy.yml`). If one did not: `docker compose -f docker-compose.yaml -f docker-compose.caddy.yml up -d`.
4. Data trouble: `restore.md`.

## Dead letters

A message whose handler threw is not dropped: the service rejects it and the broker parks it on the `dead-letters` queue with an `x-death` header naming the queue it came from and the first failure's reason (the service log has the exception, as an error, with the event's JSON). Nothing consumes that queue. The `Backup` workflow counts it every morning and goes red while it holds anything.

To look at it:

```bash
ssh -L 15672:localhost:15672 ubuntu@<server>      # then open http://localhost:15672 (guest / guest)
# or, on the server:
cd /opt/chillax && docker compose -f docker-compose.yaml -f docker-compose.caddy.yml exec -T eventbus rabbitmqctl list_queues name messages
```

The management UI shows each message's body and headers under Queues → dead-letters → Get messages. Fix the cause first (a bug, a service that was down, a bad payload). Then either redo the action in the app, which publishes a fresh event, or move the message back to its queue from the UI (Move messages, which needs the shovel plugin) — every handler that moves money or stock is idempotent, so a message applied once already is a no-op the second time. Purge the queue when it is dealt with.

Queues from before dead-lettering keep their original arguments; the broker policy `dead-letter`, which `deploy.yml` sets on every deploy, is what covers them. `rabbitmqctl list_policies` shows it.
