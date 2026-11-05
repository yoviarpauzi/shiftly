import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";

describe("buttonVariants", () => {
  // The theme colours are close to neutral. A browser reads their oklch hue as missing, so a mix
  // in oklch has no hue and is drawn as hue 0, which is red. oklab has no hue to lose.
  it("mixes the secondary hover colour in oklab, not oklch", () => {
    const classes = buttonVariants({ variant: "secondary" });

    expect(classes).toContain("color-mix(in_oklab,var(--secondary),var(--foreground)_5%)");
    expect(classes).not.toContain("in_oklch");
  });
});
