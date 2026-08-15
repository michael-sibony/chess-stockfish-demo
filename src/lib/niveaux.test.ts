import { describe, expect, it } from "vitest";
import {
  commandesUci,
  ELO_MAXIMUM_MOTEUR,
  ELO_MINIMUM_MOTEUR,
  niveauParId,
  NIVEAUX,
  optionsPourElo,
} from "./niveaux";

function valeur(options: ReturnType<typeof optionsPourElo>, nom: string) {
  return options.find((o) => o.nom === nom)?.valeur;
}

describe("optionsPourElo", () => {
  it("demande une limite d'Elo dès que le moteur sait la tenir", () => {
    const options = optionsPourElo(1800);
    expect(valeur(options, "UCI_LimitStrength")).toBe("true");
    expect(valeur(options, "UCI_Elo")).toBe(1800);
  });

  it("bascule sur Skill Level sous la borne du moteur", () => {
    // 1319 est un Elo que UCI_Elo ne sait pas viser : il faut Skill Level.
    const options = optionsPourElo(1319);
    expect(valeur(options, "UCI_LimitStrength")).toBe("false");
    expect(valeur(options, "Skill Level")).toBeTypeOf("number");
    expect(valeur(options, "UCI_Elo")).toBeUndefined();
  });

  it("bascule exactement à la borne, pas un point avant", () => {
    expect(valeur(optionsPourElo(ELO_MINIMUM_MOTEUR), "UCI_LimitStrength")).toBe(
      "true",
    );
    expect(
      valeur(optionsPourElo(ELO_MINIMUM_MOTEUR - 1), "UCI_LimitStrength"),
    ).toBe("false");
  });

  it("plafonne à l'Elo maximal accepté par le moteur", () => {
    expect(valeur(optionsPourElo(9000), "UCI_Elo")).toBe(ELO_MAXIMUM_MOTEUR);
  });

  it("garde Skill Level dans la plage 0 à 20, même pour un Elo absurde", () => {
    for (const elo of [-500, 0, 400, 800, 1200]) {
      const niveau = valeur(optionsPourElo(elo), "Skill Level") as number;
      expect(niveau).toBeGreaterThanOrEqual(0);
      expect(niveau).toBeLessThanOrEqual(20);
    }
  });

  it("monte quand l'Elo monte, sur toute la plage basse", () => {
    const faible = valeur(optionsPourElo(600), "Skill Level") as number;
    const moyen = valeur(optionsPourElo(1000), "Skill Level") as number;
    expect(moyen).toBeGreaterThan(faible);
  });

  it("refuse une valeur qui n'est pas un nombre", () => {
    expect(() => optionsPourElo(Number.NaN)).toThrow(/invalide/);
    expect(() => optionsPourElo(Number.POSITIVE_INFINITY)).toThrow(/invalide/);
  });
});

describe("commandesUci", () => {
  it("écrit la syntaxe attendue par le protocole", () => {
    expect(commandesUci(optionsPourElo(1500))).toEqual([
      "setoption name UCI_LimitStrength value true",
      "setoption name UCI_Elo value 1500",
    ]);
  });
});

describe("NIVEAUX", () => {
  it("expose des identifiants uniques", () => {
    const ids = NIVEAUX.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("est ordonné du plus faible au plus fort", () => {
    const elos = NIVEAUX.map((n) => n.elo);
    expect([...elos].sort((a, b) => a - b)).toEqual(elos);
  });

  it("laisse plus de temps de réflexion aux niveaux forts", () => {
    const temps = NIVEAUX.map((n) => n.tempsMs);
    expect([...temps].sort((a, b) => a - b)).toEqual(temps);
  });

  it("retrouve un niveau par son identifiant et rejette les autres", () => {
    expect(niveauParId("club").elo).toBe(1500);
    expect(() => niveauParId("grand-maitre")).toThrow(/inconnu/);
  });
});
