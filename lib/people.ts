export type PersonSeed = {
  email: string;
  display_name: string;
  aliases: string[];
};

export const peopleSeed: PersonSeed[] = [
  { email: "pedram@innovera.ai", display_name: "Pedram", aliases: ["pedram", "Pedram"] },
  { email: "spencer@innovera.ai", display_name: "Spencer", aliases: ["spencer", "Spencer"] },
  { email: "jeff@innovera.ai", display_name: "Jeff", aliases: ["jeff", "Jeff"] },
  { email: "daniel@innovera.ai", display_name: "Daniel", aliases: ["daniel", "Daniel", "Dan'l", "dan'l"] },
  { email: "harry@innovera.ai", display_name: "Harry", aliases: ["harry", "Harry"] },
  { email: "maksym@innovera.ai", display_name: "Maksym", aliases: ["maksym", "Maksym", "Maks", "maks", "Max", "max"] },
  { email: "olga@innovera.ai", display_name: "Olga", aliases: ["olga", "Olga"] },
  { email: "vika@innovera.ai", display_name: "Vika", aliases: ["vika", "Vika"] },
  { email: "felipe@innovera.ai", display_name: "Felipe", aliases: ["felipe", "Felipe"] },
  { email: "carson@innovera.ai", display_name: "Carson", aliases: ["carson", "Carson"] },
  { email: "hanna@innovera.ai", display_name: "Hanna", aliases: ["hanna", "Hanna"] },
  { email: "anna.h@innovera.ai", display_name: "Anna H.", aliases: ["AnnaH", "annah", "Anna H"] },
  { email: "nobu@innovera.ai", display_name: "Nobu", aliases: ["nobu", "Nobu"] }
];

const displayNameByEmail = new Map(peopleSeed.map((person) => [person.email, person.display_name]));

export function displayNameForEmail(email: string): string {
  return displayNameByEmail.get(email) ?? fallbackName(email);
}

function fallbackName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
