// src/core/prisma.js
import { PrismaClient } from '@prisma/client'

let prisma

if (!globalThis.__UCONAI_PRISMA__) {
  globalThis.__UCONAI_PRISMA__ = new PrismaClient()
}

prisma = globalThis.__UCONAI_PRISMA__

export default prisma
