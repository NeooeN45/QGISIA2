/**
 * Tests pour QuestionModal.tsx
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import QuestionModal from "../components/QuestionModal";

describe("QuestionModal", () => {
  it("affiche la question et les options", () => {
    render(
      <QuestionModal
        question="Quel mode ?"
        options={["auto", "manuel"]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Quel mode ?")).toBeTruthy();
    expect(screen.getByText("auto")).toBeTruthy();
    expect(screen.getByText("manuel")).toBeTruthy();
  });

  it("selectionne une option au clic", () => {
    render(
      <QuestionModal
        question="Choix ?"
        options={["A", "B"]}
        onSelect={vi.fn()}
      />,
    );
    const radioA = screen.getByTestId("option-A") as HTMLInputElement;
    fireEvent.click(radioA);
    expect(radioA.checked).toBe(true);
  });

  it("soumet l'option selectionnee", () => {
    const onSelect = vi.fn();
    render(
      <QuestionModal
        question="Choix ?"
        options={["A", "B"]}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("option-A"));
    fireEvent.click(screen.getByTestId("submit-answer"));
    expect(onSelect).toHaveBeenCalledWith("A");
  });

  it("ne soumet pas si aucune option selectionnee", () => {
    const onSelect = vi.fn();
    render(
      <QuestionModal
        question="Choix ?"
        options={["A", "B"]}
        onSelect={onSelect}
      />,
    );
    const btn = screen.getByTestId("submit-answer") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("appelle onCancel au clic annuler", () => {
    const onCancel = vi.fn();
    render(
      <QuestionModal
        question="Choix ?"
        options={["A", "B"]}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Annuler"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("a les attributs d'accessibilite", () => {
    render(
      <QuestionModal
        question="Question test ?"
        options={["Oui", "Non"]}
        onSelect={vi.fn()}
      />,
    );
    const modal = screen.getByTestId("question-modal");
    expect(modal.getAttribute("role")).toBe("dialog");
    expect(modal.getAttribute("aria-modal")).toBe("true");
  });
});
