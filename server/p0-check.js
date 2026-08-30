import { sanitizePrice, sanitizeListing, isJunkBrand, priceAllowed } from "../shared/cleanListing.js";
import { parseLocation } from "../server/lib/geo.js";
import { parsePrice } from "../server/lib/parse.js";

const checks = [];
function ok(name, got, expected) {
  const pass = arguments.length === 3 ? Object.is(got, expected) : !!got;
  checks.push({ name, pass, got, expected: arguments.length === 3 ? expected : true });
}

ok("yapo extra digit 17580001", sanitizePrice(17580001, "auto"), 17580000);
ok("yapo 397900001", sanitizePrice(397900001, "auto"), 39790000);
ok("autocosmos pie only", sanitizePrice(1600000, "auto", "Pie: $1.600.000"), null);
ok("autocosmos pie+price", sanitizePrice(1600000, "auto", "Pie: $1.600.000 Precio $12.500.000"), 12500000);
ok("las condes region", parseLocation("Las Condes").region, "Metropolitana de Santiago");
ok("las condes city", parseLocation("Las Condes").city, "Las Condes");
ok("temuco region", parseLocation("Temuco").region, "Araucanía");
ok("bio-bio", parseLocation("Bío-Bío").region, "Biobío");
ok("ml slug region", parseLocation("santiago-metropolitana").region, "Metropolitana de Santiago");
ok("price floor auto", priceAllowed(500000, "auto"), false);
ok("price floor liviano", priceAllowed(800000, "auto"), true);
ok("junk cuatrimoto", isJunkBrand("Cuatrimoto"), true);
ok("toyota ok", isJunkBrand("Toyota"), false);
ok("year 2028", sanitizeListing({ brand: "Toyota", model: "Yaris", price: 8000000, year: 2028, category: "auto" })?.year, null);
ok("parsePrice yapo", parsePrice("$17.580.001", "auto"), 17580000);
ok("peugeot extra zero", sanitizePrice(62900000, "auto", "Peugeot 308 2017", "Peugeot", 2017), 6290000);
ok("ecosport 2021 extra zero", sanitizePrice(82900000, "auto", "Ford Ecosport 2021", "Ford", 2021), 8290000);
ok("audi r8 keep", sanitizePrice(79990000, "auto", "Audi R8 2015", "Audi", 2015), 79990000);

const ranger = sanitizeListing(
  { brand: "Ford", model: "Ranger", price: 17580001, year: 2022, category: "camioneta", region: "Las Condes", city: "Las Condes" },
  parseLocation
);
ok("ranger price", ranger?.price, 17580000);
ok("ranger geo", ranger?.region === "Metropolitana de Santiago" && ranger?.city === "Las Condes");

const failed = checks.filter((c) => !c.pass);
console.log(JSON.stringify({ passed: checks.length - failed.length, failed }, null, 2));
process.exit(failed.length ? 1 : 0);
