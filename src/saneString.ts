import { z } from "zod";

// sanity checked schemas for common types
export const ZSaneString = z.string().trim().min(1).max(100);
export const ZSaneEmail = z.string().email().max(100);
export const ZSaneQuantity = z.number().int().positive();
export const ZSaneDate = z.coerce.date().min(new Date("2010-01-01"));

// general purpose identifier schema
export const genericIdPattern = `[0-9a-zA-Z-_.]+`; // no ^ or $ for use in routes
export const ZSaneIdentifier = z.string().trim().regex(/^[0-9a-zA-Z-_.]+$/).max(100);
