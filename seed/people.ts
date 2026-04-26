import { peopleSeed } from "@/lib/people";
import { supabaseService } from "@/lib/supabase/server";

async function main() {
  const sb = supabaseService();

  const { error: peopleError } = await sb.from("people").upsert(
    peopleSeed.map((person) => ({
      email: person.email,
      display_name: person.display_name,
      aliases: person.aliases
    })),
    { onConflict: "email" }
  );
  if (peopleError) throw peopleError;

  const aliases = peopleSeed.flatMap((person) =>
    person.aliases.map((alias) => ({
      alias: alias.trim().toLowerCase(),
      canonical_email: person.email
    }))
  );

  const { error: aliasDeleteError } = await sb.from("name_aliases").delete().not("alias", "is", null);
  if (aliasDeleteError) throw aliasDeleteError;

  const { error: aliasError } = await sb.from("name_aliases").insert(aliases);
  if (aliasError) throw aliasError;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
