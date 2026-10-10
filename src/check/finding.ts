// 指摘の型(§9.5)・重さ(違反 / 注意 / 情報)・並び順(CLI 版 FR-9 の順)と、検査の関数に渡す文脈の型。
// 純関数。obsidian を import しない。index.ts と各検査の両方から読む(循環 import を避けるため分けた)。
import type { Rules } from "../rules/validate";
import type { Doc } from "./lines";
import type { Profile } from "./profile";

/** 並び順もこの順(§9.5) */
export const KINDS = [
	"unclosed_fence", "undefined_ref", "duplicate_def", "missing_title", "missing_section",
	"section_order", "duplicate_section", "missing_subheading", "retreat_empty", "zero_phrase", "no_s8_mention",
	"no_tentative", "numbering_gap", "missing_priority", "emoji", "heading_text", "extra_h2", "no_placeholder",
	"unknown_prefix", "excluded_ref",
] as const;
export type Kind = typeof KINDS[number];
export type Level = "violation" | "caution" | "info";

export interface Finding {
	kind: Kind;
	level: Level;
	/** 0 始まり。行の無い指摘は持たない */
	line?: number;
	text: string;
	productName?: string;
	count?: number;
}

const CAUTION = new Set<Kind>(["undefined_ref", "heading_text", "extra_h2", "no_placeholder", "unknown_prefix"]);
export const levelOf = (k: Kind): Level => (k === "excluded_ref" ? "info" : CAUTION.has(k) ? "caution" : "violation");

export function finding(kind: Kind, text: string, line?: number, extra?: { productName?: string; count?: number }): Finding {
	return { kind, level: levelOf(kind), text, ...(line === undefined ? {} : { line }), ...extra };
}

/** 番号の定義(§9.6) */
export interface Def {
	prefix: string;
	/** 数として(FR-01 と FR-1 は同じ) */
	no: number;
	branch: string;
	/** 元の文字のまま(表示用) */
	raw: string;
	line: number;
}

export interface DefScan {
	/** prefixes にある接頭辞の定義 */
	defs: Def[];
	/** prefixes に無い接頭辞の定義の形(FR-17。検査の対象にしない) */
	unknown: Def[];
}

export interface Ctx {
	doc: Doc;
	rules: Rules;
	profile: Profile;
	/** 仕様書フォルダの下のフォルダのパス(プロダクト名の材料) */
	folders: string[];
	/** 判定していない物をここに足す(INV-6) */
	undecided: string[];
	/** 番号の定義(初めて呼んだときに読む) */
	defs: () => DefScan;
}
