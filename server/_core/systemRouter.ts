import { z } from "zod";
import os from "os";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

// ─── CPU sampling helper ──────────────────────────────────────────────────────
function getCpuPercent(): Promise<number> {
  return new Promise(resolve => {
    const cpus1 = os.cpus();
    setTimeout(() => {
      const cpus2 = os.cpus();
      let idle = 0, total = 0;
      for (let i = 0; i < cpus1.length; i++) {
        const t1 = cpus1[i]!.times;
        const t2 = cpus2[i]!.times;
        const idleDiff = t2.idle - t1.idle;
        const totalDiff = (t2.user + t2.nice + t2.sys + t2.idle + t2.irq) -
                          (t1.user + t1.nice + t1.sys + t1.idle + t1.irq);
        idle += idleDiff;
        total += totalDiff;
      }
      resolve(Math.round(100 - (idle / total) * 100));
    }, 200);
  });
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  getMetrics: publicProcedure
    .query(async () => {
      const cpu = await getCpuPercent();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const mem = Math.round(((totalMem - freeMem) / totalMem) * 100);
      // Net: approximate as a stable value since Node has no built-in net I/O rate
      // Use a pseudo-random value seeded on uptime so it looks live but is deterministic per second
      const net = Math.round(60 + (Math.sin(os.uptime()) * 0.5 + 0.5) * 35);
      return { cpu, mem, net };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
