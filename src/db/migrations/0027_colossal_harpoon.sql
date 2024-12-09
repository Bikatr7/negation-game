-- Create enum types first
CREATE TYPE "doubt_status" AS ENUM ('active', 'resolved');
CREATE TYPE "stake_status" AS ENUM ('active', 'slashed');

-- Then create tables using those enums
CREATE TABLE "doubts" (
	"id" serial PRIMARY KEY NOT NULL,
	"point_id" integer NOT NULL,
	"negation_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" "doubt_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "unique_user_doubt" UNIQUE("user_id","point_id","negation_id"),
	CONSTRAINT "non_negative_amount" CHECK ("doubts"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "restakes" (
	"id" serial PRIMARY KEY NOT NULL,
	"point_id" integer NOT NULL,
	"negation_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" "stake_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "unique_user_stake" UNIQUE("user_id","point_id","negation_id"),
	CONSTRAINT "non_negative_amount" CHECK ("restakes"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "slashing_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"restake_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reason" text,
	CONSTRAINT "non_negative_amount" CHECK ("slashing_events"."amount" >= 0)
);
--> statement-breakpoint
DROP VIEW "public"."point_favor_history";--> statement-breakpoint
DROP VIEW "public"."point_with_details_view";--> statement-breakpoint
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_negation_id_points_id_fk" FOREIGN KEY ("negation_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restakes" ADD CONSTRAINT "restakes_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restakes" ADD CONSTRAINT "restakes_negation_id_points_id_fk" FOREIGN KEY ("negation_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restakes" ADD CONSTRAINT "restakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slashing_events" ADD CONSTRAINT "slashing_events_restake_id_restakes_id_fk" FOREIGN KEY ("restake_id") REFERENCES "public"."restakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slashing_events" ADD CONSTRAINT "slashing_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doubts_point_id_idx" ON "doubts" USING btree ("point_id");--> statement-breakpoint
CREATE INDEX "doubts_negation_id_idx" ON "doubts" USING btree ("negation_id");--> statement-breakpoint
CREATE INDEX "doubts_user_id_idx" ON "doubts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "restakes_point_id_idx" ON "restakes" USING btree ("point_id");--> statement-breakpoint
CREATE INDEX "restakes_negation_id_idx" ON "restakes" USING btree ("negation_id");--> statement-breakpoint
CREATE INDEX "restakes_user_id_idx" ON "restakes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "slashing_restake_id_idx" ON "slashing_events" USING btree ("restake_id");--> statement-breakpoint
CREATE INDEX "slashing_user_id_idx" ON "slashing_events" USING btree ("user_id");--> statement-breakpoint
CREATE VIEW "public"."restake_details_view" AS (select "points"."id", COALESCE(SUM("restakes"."amount"), 0) as "total_restaked_amount", COALESCE(SUM(CASE WHEN "restakes"."status" = 'active' THEN "restakes"."amount" ELSE 0 END), 0) as "active_restaked_amount", COALESCE(SUM("slashing_events"."amount"), 0) as "slashed_amount", COUNT(DISTINCT "restakes"."user_id") as "unique_restakers_count", COALESCE(SUM("doubts"."amount"), 0) as "total_doubt_amount", COUNT(DISTINCT "doubts"."user_id") as "unique_doubters_count", GREATEST(MAX("restakes"."updated_at"), MAX("doubts"."created_at"), MAX("slashing_events"."created_at")) as "last_activity_timestamp" from "points" left join "restakes" on "restakes"."point_id" = "points"."id" left join "doubts" on "doubts"."point_id" = "points"."id" left join "slashing_events" on "slashing_events"."restake_id" = "restakes"."id" group by "points"."id");--> statement-breakpoint
CREATE VIEW "public"."user_staking_stats_view" AS (select "users"."id", COALESCE(SUM("restakes"."amount"), 0) as "total_restaked_amount", COALESCE(SUM("doubts"."amount"), 0) as "total_doubted_amount", COUNT(CASE WHEN "restakes"."status" = 'active' THEN 1 END) as "active_restakes_count", COUNT(CASE WHEN "doubts"."status" = 'resolved' THEN 1 END) as "successful_doubts_count", COALESCE(SUM("slashing_events"."amount"), 0) as "total_slashed_amount", EXTRACT(EPOCH FROM AVG(
        CASE 
          WHEN "restakes"."status" = 'active' THEN NOW() - "restakes"."created_at"
          ELSE "slashing_events"."created_at" - "restakes"."created_at"
        END
      )) / 86400 as "average_stake_duration" from "users" left join "restakes" on "restakes"."user_id" = "users"."id" left join "doubts" on "doubts"."user_id" = "users"."id" left join "slashing_events" on "slashing_events"."user_id" = "users"."id" group by "users"."id");--> statement-breakpoint
CREATE VIEW "public"."point_favor_history" AS (with "all_events" as (((((((((select "id" as point_id, "created_at" as event_time, 'point_created' as event_type from "points") union (select "point_id" as point_id, "created_at" as event_time, 'endorsement_made' as event_type from "endorsements")) union (select "older_point_id" as point_id, "created_at" as event_time, 'negation_made' as event_type from "negations")) union (select "newer_point_id" as point_id, "created_at" as event_time, 'negation_made' as event_type from "negations")) union (select CASE 
              WHEN "negations"."older_point_id" = "endorsements"."point_id" 
              THEN "negations"."newer_point_id"
              ELSE "negations"."older_point_id"
            END as point_id, "endorsements"."created_at" as event_time, 'negation_endorsed' as event_type from "endorsements" left join "negations" on (
              ("negations"."older_point_id" = "endorsements"."point_id" OR 
               "negations"."newer_point_id" = "endorsements"."point_id")
              AND "negations"."created_at" <= "endorsements"."created_at"
            ))) union (select "id" as point_id, NOW() as event_time, 'favor_queried' as event_type from "points")) union (select "point_id", "created_at", 'restake_made' from "restakes")) union (select "point_id", "created_at", 'doubt_placed' from "doubts")) union (select "restakes"."point_id", "slashing_events"."created_at", 'stake_slashed' from "slashing_events" inner join "restakes" on "restakes"."id" = "slashing_events"."restake_id")) select "all_events_with_stats".point_id as "point_id", "all_events_with_stats".event_type as "event_type", "all_events_with_stats".event_time as "event_time", "all_events_with_stats".cred as "cred", "all_events_with_stats".negations_cred as "negations_cred", CAST(
            CASE
                WHEN "all_events_with_stats".cred = 0 THEN 0
                WHEN "all_events_with_stats".negations_cred = 0 THEN 100
                ELSE ROUND(100.0 * "all_events_with_stats".cred / ("all_events_with_stats".cred + "all_events_with_stats".negations_cred), 2)
            END
        AS NUMERIC) as "favor" from (select "all_events".point_id as "point_id", "all_events".event_type as "event_type", "all_events".event_time as "event_time", 
          COALESCE((
            SELECT SUM("cred")
            FROM "endorsements"
            WHERE "point_id" = "all_events".point_id
            AND "created_at" <= "all_events".event_time
          ), 0)
         as "cred", 
          COALESCE((
            SELECT SUM("cred")
            FROM "endorsements"
            WHERE "point_id" IN (
              SELECT newer_point_id
              FROM "negations"
              WHERE older_point_id = "all_events".point_id
              AND "created_at" <= "all_events".event_time
              UNION
              SELECT older_point_id
              FROM "negations"
              WHERE newer_point_id = "all_events".point_id
              AND "created_at" <= "all_events".event_time
            ) AND "created_at" <= "all_events".event_time
          ), 0)
         as "negations_cred" from "all_events") "all_events_with_stats" order by "all_events_with_stats".event_time, "all_events_with_stats".point_id);--> statement-breakpoint
CREATE VIEW "public"."point_with_details_view" AS (
  SELECT 
    points.id,
    points.content,
    points.created_at,
    points.created_by,
    COALESCE((
      SELECT COUNT(*)
      FROM (
        SELECT older_point_id AS point_id FROM negations
        UNION ALL
        SELECT newer_point_id AS point_id FROM negations
      ) sub
      WHERE point_id = points.id
    ), 0) as amount_negations,
    COALESCE((
      SELECT COUNT(DISTINCT user_id)
      FROM endorsements
      WHERE point_id = points.id
    ), 0) as amount_supporters,
    COALESCE((
      SELECT SUM(cred)
      FROM endorsements
      WHERE point_id = points.id
    ), 0) as cred,
    COALESCE((
      SELECT SUM(cred)
      FROM endorsements
      WHERE point_id IN (
        SELECT newer_point_id
        FROM negations
        WHERE older_point_id = points.id
        UNION
        SELECT older_point_id
        FROM negations
        WHERE newer_point_id = points.id
      )
    ), 0) as negations_cred,
    ARRAY(
      SELECT older_point_id
      FROM negations
      WHERE newer_point_id = points.id
      UNION
      SELECT newer_point_id
      FROM negations
      WHERE older_point_id = points.id
    ) as negation_ids,
    COALESCE((
      SELECT SUM(amount)
      FROM restakes
      WHERE point_id = points.id
      AND status = 'active'
    ), 0) as total_restaked_amount,
    COALESCE((
      SELECT SUM(amount)
      FROM restakes
      WHERE point_id = points.id
      AND status = 'active'
    ), 0) as active_restaked_amount,
    COALESCE((
      SELECT SUM(amount)
      FROM doubts
      WHERE point_id = points.id
      AND status = 'active'
    ), 0) as total_doubt_amount,
    COALESCE((
      SELECT COUNT(*)
      FROM slashing_events
      JOIN restakes ON restakes.id = slashing_events.restake_id
      WHERE restakes.point_id = points.id
    ), 0) as slashing_events_count
  FROM points
);

DROP VIEW "public"."point_favor_history";

CREATE VIEW "public"."point_favor_history" AS (
  WITH "all_events" AS (
    SELECT "id" as point_id, "created_at" as event_time, 'point_created' as event_type,
      COALESCE((
        SELECT SUM("cred")
        FROM "endorsements"
        WHERE "point_id" = "points"."id"
        AND "created_at" <= "points"."created_at"
      ), 0) as base_cred,
      COALESCE((
        SELECT SUM("amount")
        FROM "restakes"
        WHERE "point_id" = "points"."id"
        AND "status" = 'active'
        AND "created_at" <= "points"."created_at"
      ), 0) as restake_amount,
      COALESCE((
        SELECT SUM("amount")
        FROM "doubts"
        WHERE "point_id" = "points"."id"
        AND "status" = 'active'
        AND "created_at" <= "points"."created_at"
      ), 0) as doubt_amount
    FROM "points"
  )
  SELECT 
    point_id,
    event_time,
    event_type,
    base_cred + restake_amount - doubt_amount as "cred",
    CAST(
      CASE
        WHEN base_cred + restake_amount - doubt_amount = 0 THEN 0
        WHEN base_cred = 0 THEN 100
        ELSE ROUND(100.0 * (base_cred + restake_amount - doubt_amount) / (base_cred + restake_amount), 2)
      END
    AS NUMERIC) as "favor"
  FROM "all_events"
  ORDER BY event_time, point_id
);

DROP VIEW "public"."point_favor_history";

CREATE VIEW "public"."point_favor_history" AS (
  WITH "all_events" AS (
    (SELECT "id" as point_id, "created_at" as event_time, 'point_created' as event_type FROM "points")
    UNION (SELECT "point_id", "created_at", 'endorsement_made' FROM "endorsements")
    UNION (SELECT "older_point_id", "created_at", 'negation_made' FROM "negations")
    UNION (SELECT "newer_point_id", "created_at", 'negation_made' FROM "negations")
    UNION (SELECT "point_id", "created_at", 'restake_made' FROM "restakes")
    UNION (SELECT "point_id", "created_at", 'doubt_placed' FROM "doubts")
    UNION (SELECT r."point_id", s."created_at", 'stake_slashed' 
           FROM "slashing_events" s
           JOIN "restakes" r ON r.id = s.restake_id)
  ),
  "point_cred" AS (
    SELECT 
      e.point_id,
      e.event_time,
      e.event_type,
      COALESCE((
        SELECT SUM(cred) + 
               COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.amount ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN d.status = 'active' THEN d.amount ELSE 0 END), 0)
        FROM endorsements en
        LEFT JOIN restakes r ON r.point_id = en.point_id AND r.created_at <= e.event_time
        LEFT JOIN doubts d ON d.point_id = en.point_id AND d.created_at <= e.event_time
        WHERE en.point_id = e.point_id AND en.created_at <= e.event_time
      ), 0) as cred
    FROM "all_events" e
  )
  SELECT 
    point_id,
    event_time,
    event_type,
    cred,
    CAST(
      CASE
        WHEN cred = 0 THEN 0
        ELSE ROUND(100.0 * cred / (cred + COALESCE((
          SELECT SUM(cred)
          FROM endorsements en2
          WHERE en2.point_id IN (
            SELECT newer_point_id FROM negations WHERE older_point_id = point_cred.point_id
            UNION
            SELECT older_point_id FROM negations WHERE newer_point_id = point_cred.point_id
          )
          AND en2.created_at <= point_cred.event_time
        ), 0)), 2)
      END
    AS NUMERIC) as favor
  FROM "point_cred"
  ORDER BY event_time, point_id
); 