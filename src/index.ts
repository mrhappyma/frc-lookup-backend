import express from "express";
import env from "./utils/env";
import Cron from "croner";

export const api = express();
let syncStatus: string = "idle";
let lastSync: string = "never";
let teamCacheReady = false;
let photoCacheReady = false;

api.get("/", (req, res) => {
  res.send(`sync status: ${syncStatus}, last sync: ${lastSync}`);
});

const teamCache = new Map<number, Team>();
const photoCaches = new Map<number, Map<number, string>>();
const syncCaches = async () => {
  syncStatus = "syncing teams";
  const baseUrl = "https://www.thebluealliance.com/api/v3";
  for (let i = 0; i < 20; i += 1) {
    const teamBatch = await fetch(`${baseUrl}/teams/${i}`, {
      headers: {
        "X-TBA-Auth-Key": env.TBA_TOKEN,
      },
    });
    const teamBatchJson = (await teamBatch.json()) as TeamTBAResponse[];
    for (const team of teamBatchJson) {
      teamCache.set(team.team_number, {
        number: team.team_number,
        nickname: team.nickname,
        city: `${team.city}, ${team.state_prov}`,
        rookieYear: team.rookie_year,
      });
    }
  }
  teamCacheReady = true;
  syncStatus = "syncing photos";
  const currentYear = new Date().getFullYear();
  for (let i = 1992; i <= currentYear; i += 1) {
    syncStatus = `syncing photos for ${i}`;
    const existingTeams = Array.from(teamCache.values()).filter(
      (team) => team.rookieYear <= i
    );
    const yearCache = new Map<number, string>();
    for (const team of existingTeams) {
      const teamPhoto = await fetch(
        `${baseUrl}/team/frc${team.number}/media/${i}`,
        {
          headers: {
            "X-TBA-Auth-Key": env.TBA_TOKEN,
          },
        }
      );
      const teamPhotoJson = (await teamPhoto.json()) as TeamPhotoTBAResponse[];
      //TODO: instagram images
      const photo = teamPhotoJson.find(
        (photo) =>
          photo.preferred &&
          photo.direct_url.startsWith("https://") &&
          photo.type === "imgur"
      );
      if (photo) {
        yearCache.set(team.number, photo.direct_url);
      }
    }
    photoCaches.set(i, yearCache);
  }
  photoCacheReady = true;
  lastSync = new Date().toISOString();
  syncStatus = "idle";
};
syncCaches();
Cron("0 9 * * MON", syncCaches);

api.get("/teams", (req, res) => {
  if (!teamCacheReady) {
    res.status(503).send("Teams not ready");
    return;
  }
  res.json(Array.from(teamCache.values()));
});
api.get("/teams/:teamNumber", (req, res) => {
  if (!teamCacheReady) {
    res.status(503).send("Teams not ready");
    return;
  }
  const teamNumber = parseInt(req.params.teamNumber);
  const team = teamCache.get(teamNumber);
  if (team) {
    res.json(team);
  } else {
    res.status(404).send("Team not found");
  }
});

api.get("/photos/:year", (req, res) => {
  if (!photoCacheReady) {
    res.status(503).send("Photos not ready");
    return;
  }
  const year = parseInt(req.params.year);
  const photos = photoCaches.get(year);
  if (photos) {
    res.json(
      Array.from(photos.entries()).map(([teamNumber, url]) => ({
        teamNumber,
        url,
      }))
    );
  } else {
    res.status(404).send("Photos not found");
  }
});
api.get("/photos/:year/:teamNumber", (req, res) => {
  if (!photoCacheReady) {
    res.status(503).send("Photos not ready");
    return;
  }
  const year = parseInt(req.params.year);
  const teamNumber = parseInt(req.params.teamNumber);
  const photos = photoCaches.get(year);
  if (photos) {
    const url = photos.get(teamNumber);
    if (url) {
      res.json({ teamNumber, url });
    } else {
      res.status(404).send("Photo not found");
    }
  } else {
    res.status(404).send("Photos not found");
  }
});

api.listen(env.PORT, () => {
  console.log(`listening on port ${env.PORT}`);
});
