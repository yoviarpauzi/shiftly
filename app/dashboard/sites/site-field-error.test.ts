import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldError } from "@/components/ui/field";
import { DUPLICATE_NAME_MESSAGE, nameFieldError } from "./site-rules";

describe("nameFieldError", () => {
  it("returns no error when there is no message", () => {
    expect(nameFieldError(undefined)).toBeUndefined();
  });

  it("wraps the message in the { message } shape that FieldError reads", () => {
    expect(nameFieldError(DUPLICATE_NAME_MESSAGE)).toEqual({
      message: DUPLICATE_NAME_MESSAGE,
    });
  });

  it("renders the message when FieldError receives the wrapped error", () => {
    const html = renderToStaticMarkup(
      createElement(FieldError, { errors: [nameFieldError(DUPLICATE_NAME_MESSAGE)] }),
    );

    expect(html).toContain(DUPLICATE_NAME_MESSAGE);
  });
});
