# ProSync CRM continuous deployment

The production CRM is a self-hosted Next.js application running under PM2 on
the Hostinger VPS. Nginx proxies `crm.prosyncedu.com` to
`http://127.0.0.1:3010`.

After setup, every push to `main` runs
`.github/workflows/deploy-production.yml`. The workflow connects to the VPS as
the restricted `deploy` user and deploys the exact pushed Git commit.

## Deployment behavior

The production script:

1. Refuses to continue if tracked files were manually changed on the VPS.
2. Refuses a diverged checkout or a commit outside `origin/main`.
3. Installs exactly the dependencies in `package-lock.json`.
4. Validates and generates Prisma Client.
5. Builds Next.js before changing the running PM2 process.
6. Applies the MongoDB Prisma schema without accepting data loss.
7. Reloads `prosync-crm` on `127.0.0.1:3010` through PM2.
8. Checks the local process and then `https://crm.prosyncedu.com`.

The server's `/var/www/prosync-crm/.env` remains on the VPS. It is not stored
in GitHub and is not replaced during deployment.

## One-time SSH setup

Generate a dedicated Ed25519 key. Do not reuse a personal SSH key. On Windows,
run:

```powershell
ssh-keygen -t ed25519 -C "github-actions-prosync-crm" -f "$env:USERPROFILE\.ssh\prosync_crm_github_actions"
```

Press Enter twice when asked for a passphrase because GitHub Actions must use
this dedicated key non-interactively.

Copy the single line from `prosync_crm_github_actions.pub`, connect to the VPS
as root, and install it for `deploy`:

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
echo 'PASTE_THE_PUBLIC_KEY_LINE_HERE' >> /home/deploy/.ssh/authorized_keys
```

Confirm that the VPS checkout can fetch the private GitHub repository:

```bash
sudo -iu deploy bash -lc 'cd /var/www/prosync-crm && git fetch origin main'
```

This must succeed without prompting. If it does not, configure a separate
read-only GitHub deploy key for the VPS repository checkout before enabling the
workflow.

## GitHub Actions secrets

Open the `ProSyncHub/Platinum-CRM` repository, then go to **Settings → Secrets
and variables → Actions → New repository secret**.

Add these secrets:

| Secret                | Value                                                            |
| --------------------- | ---------------------------------------------------------------- |
| `VPS_HOST`            | `200.97.174.113`                                                 |
| `VPS_USER`            | `deploy`                                                         |
| `VPS_PORT`            | `22`                                                             |
| `VPS_SSH_PRIVATE_KEY` | Entire contents of the private `prosync_crm_github_actions` file |
| `VPS_SSH_KNOWN_HOSTS` | Trusted SSH host-key line for `200.97.174.113`                   |

Obtain the trusted Ed25519 host key directly from the already-authenticated VPS
session:

```bash
printf '200.97.174.113 '
cat /etc/ssh/ssh_host_ed25519_key.pub
```

The secret value must be one line in this form:

```text
200.97.174.113 ssh-ed25519 AAAA...
```

Never put the CRM `.env`, database URL, Zoom credentials, API keys, passwords,
or SSH private key directly in the workflow YAML.

## First deployment

After all secrets are present:

1. Open **Actions → Deploy CRM to production VPS**.
2. Select **Run workflow** on `main`.
3. Confirm the deployment job succeeds.
4. Open `https://crm.prosyncedu.com` and test login and member search.

Every later push to `main` deploys automatically. For rollback, revert the bad
Git commit and push the revert to `main`; do not edit production files manually.
