import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  casesDepuis,
  estSombre,
  etatPartie,
  glyphe,
  libelleCase,
  nomPiece,
} from "./echiquier";
import { decouperCoupUci } from "./moteur";

describe("casesDepuis", () => {
  it("produit 64 cases, de a8 à h1", () => {
    const cases = casesDepuis(new Chess());
    expect(cases).toHaveLength(64);
    expect(cases[0].nom).toBe("a8");
    expect(cases[63].nom).toBe("h1");
  });

  it("place les pièces de la position initiale", () => {
    const cases = casesDepuis(new Chess());
    const parNom = new Map(cases.map((c) => [c.nom, c]));
    expect(parNom.get("e1")?.piece).toEqual({ type: "k", couleur: "w" });
    expect(parNom.get("d8")?.piece).toEqual({ type: "q", couleur: "b" });
    expect(parNom.get("e4")?.piece).toBeNull();
  });
});

describe("estSombre", () => {
  it("rend a1 sombre et h1 claire, comme un vrai échiquier", () => {
    expect(estSombre("a", 1)).toBe(true);
    expect(estSombre("h", 1)).toBe(false);
    expect(estSombre("a", 8)).toBe(false);
    expect(estSombre("h", 8)).toBe(true);
  });
});

describe("nomPiece", () => {
  it("accorde le féminin de la dame et de la tour", () => {
    expect(nomPiece({ type: "q", couleur: "b" })).toBe("dame noire");
    expect(nomPiece({ type: "r", couleur: "w" })).toBe("tour blanche");
    expect(nomPiece({ type: "n", couleur: "b" })).toBe("cavalier noir");
    expect(nomPiece({ type: "k", couleur: "w" })).toBe("roi blanc");
  });
});

describe("libelleCase", () => {
  it("annonce la case avant son contenu", () => {
    expect(
      libelleCase({ nom: "e4", piece: null, sombre: false }),
    ).toBe("e4, case vide");
    expect(
      libelleCase({
        nom: "d1",
        piece: { type: "q", couleur: "w" },
        sombre: false,
      }),
    ).toBe("d1, dame blanche");
  });
});

describe("glyphe", () => {
  it("distingue les deux couleurs", () => {
    expect(glyphe({ type: "k", couleur: "w" })).toBe("♔");
    expect(glyphe({ type: "k", couleur: "b" })).toBe("♚");
  });
});

describe("etatPartie", () => {
  it("annonce le trait sur la position initiale", () => {
    expect(etatPartie(new Chess())).toBe("Aux blancs de jouer.");
  });

  it("reconnaît le mat du berger et nomme le gagnant", () => {
    const partie = new Chess();
    for (const coup of ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]) {
      partie.move(coup);
    }
    expect(partie.isCheckmate()).toBe(true);
    expect(etatPartie(partie)).toBe(
      "Échec et mat, les noirs sont mat, les blancs gagnent.",
    );
  });

  it("distingue un échec simple d'un mat", () => {
    // Tour blanche en e1, roi noir en e8 : échec sur la colonne. Le roi peut
    // fuir en d8 ou f8, donc ce n'est pas un mat.
    const partie = new Chess("4k3/8/8/8/8/8/8/4R1K1 b - - 0 1");
    expect(partie.isCheck()).toBe(true);
    expect(partie.isCheckmate()).toBe(false);
    expect(etatPartie(partie)).toBe("Échec au roi, aux noirs de jouer.");
  });

  it("reconnaît le pat, qui n'est pas une défaite", () => {
    const partie = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(partie.isStalemate()).toBe(true);
    expect(etatPartie(partie)).toBe("Pat, la partie est nulle.");
  });

  it("reconnaît le matériel insuffisant", () => {
    const partie = new Chess("4k3/8/8/8/8/8/8/4KB2 w - - 0 1");
    expect(etatPartie(partie)).toBe(
      "Matériel insuffisant, la partie est nulle.",
    );
  });
});

describe("decouperCoupUci", () => {
  it("découpe un coup simple", () => {
    expect(decouperCoupUci("e2e4")).toEqual({
      depuis: "e2",
      vers: "e4",
      promotion: undefined,
    });
  });

  it("lit la promotion, la cinquième lettre", () => {
    expect(decouperCoupUci("e7e8q")).toEqual({
      depuis: "e7",
      vers: "e8",
      promotion: "q",
    });
  });
});
