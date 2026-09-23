import type { ReactNode } from "react";

/**
 * The settlement and its pages, with the modal slot the storage opens in
 * when a player clicks its pin. The slot is empty (`@modal/default.tsx`) on
 * every other URL, and on a direct visit to the storage, which then renders
 * as its own page.
 */
export default function SettlementLayout(props: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {props.children}
      {props.modal}
    </>
  );
}
