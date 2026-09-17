import { sqliteTable,text,integer,index } from "drizzle-orm/sqlite-core";
export const wishes=sqliteTable("wishes",{
 id:text("id").primaryKey(),
 name:text("name").notNull(),
 message:text("message").notNull(),
 kind:text("kind",{enum:["wish","greeting"]}).notNull(),
 created_at:integer("created_at").notNull(),
},table=>[index("idx_wishes_created_at").on(table.created_at)]);
