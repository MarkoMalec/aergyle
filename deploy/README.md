# deploy/

The files that live on the **host**, not in the image.

| File | Goes where |
|---|---|
| `docker-compose.yml` | `~/aergyle-deploy/docker-compose.yml` |
| `deploy.sh` | `~/aergyle-deploy/deploy.sh` |
| `.env.example` | copy to `~/aergyle-deploy/.env`, fill in, `chmod 600` |
| `mmo.markomalec.com.conf` | `/etc/apache2/sites-available/` |

Full workflow — building, deploying, rolling back, first-time host setup,
moving to a VPS, and troubleshooting — is in
**[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)**.

Day to day:

```bash
cd ~/aergyle-deploy && ./deploy.sh          # newest build from main
cd ~/aergyle-deploy && ./deploy.sh <sha>    # a specific build, or roll back
```
