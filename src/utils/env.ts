import { z } from "zod";

const envSchema = z.object({
    PORT: z.string().default("3000"),
    TBA_TOKEN: z.string(),
});
export default envSchema.parse(process.env);