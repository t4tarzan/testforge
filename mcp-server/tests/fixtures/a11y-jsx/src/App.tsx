// FIXTURE — mix of accessible and inaccessible JSX patterns.

import React from 'react';

export function BadImg() {
  // BAD — img with no alt attribute.
  return <img src="/hero.png" />;
}

export function GoodImg() {
  return <img src="/hero.png" alt="Hero image of the testforge dashboard" />;
}

export function DecorativeImg() {
  // GOOD — empty alt is valid for purely decorative images.
  return <img src="/divider.svg" alt="" />;
}

export function IconOnlyButton() {
  // BAD — icon-only button with no accessible name.
  return (
    <button onClick={() => {}}>
      <svg width="16" height="16" />
    </button>
  );
}

export function GoodButton() {
  return <button aria-label="Close dialog" onClick={() => {}}><svg /></button>;
}

export function AnchorWithText() {
  return <a href="/pricing">View pricing</a>;
}

export function AnchorNoText() {
  // BAD — empty anchor.
  return <a href="/somewhere" />;
}

export function ExternalLinkBad() {
  // BAD — target="_blank" without rel="noopener".
  return <a href="https://example.com" target="_blank">Example</a>;
}

export function ExternalLinkGood() {
  return <a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a>;
}

export function InputNoLabel() {
  // BAD — input with no label association.
  return <input type="text" placeholder="Search" />;
}

export function InputWithLabel() {
  return <input type="text" aria-label="Search the docs" />;
}

export function ClickableDiv() {
  // BAD — onClick on a div without role + tabIndex.
  return <div onClick={() => {}}>Click me</div>;
}

export function AccessibleDivButton() {
  return (
    <div role="button" tabIndex={0} onClick={() => {}} onKeyDown={() => {}}>
      Click me
    </div>
  );
}

export function EmptyAriaLabel() {
  // BAD — empty aria-label is a screen-reader anti-pattern.
  return <button aria-label="">Save</button>;
}

export function HiddenInputOk() {
  // GOOD — hidden inputs don't need labels.
  return <input type="hidden" value="csrf-token" />;
}
