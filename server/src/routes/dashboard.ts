import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { dashboardService } from "../services/dashboard.js";
import { companyService } from "../services/companies.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);
  const companiesSvc = companyService(db);

  router.get("/companies/dashboard/all", async (req, res) => {
    assertBoard(req);
    const allCompanies = await companiesSvc.list();
    const accessible =
      req.actor.source === "local_implicit" || req.actor.isInstanceAdmin
        ? allCompanies
        : allCompanies.filter((c) => (req.actor.companyIds ?? []).includes(c.id));
    const summaries = await svc.summaryAll(accessible.map((c) => c.id));
    res.json(summaries);
  });

  router.get("/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);
    res.json(summary);
  });

  return router;
}
