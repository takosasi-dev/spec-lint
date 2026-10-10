// 右サイドバーのパネル(§9.5・FR-19): 仕様書と型・規則ノートと updated・検査の時刻と所要・欄の数・件数と、違反/注意/情報の一覧。
// 要素は createEl / createDiv だけで作り、仕様書の文は文字として出す(INV-9)。データは plugin が持ち、ここは描くだけ。
// 行のある項目を押すとその行へ移る(FR-20)。開け閉めは描き直しても保つ。
import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { CheckResult } from "./check";
import type { Finding, Kind, Level } from "./check/finding";
import type SpecLintPlugin from "./main";
import { openAt } from "./nav";

export const VIEW_TYPE = "spec-lint-panel";

const LABEL: Record<Kind, string> = {
	unclosed_fence: "閉じていないコードブロック", undefined_ref: "定義が見つからない参照", duplicate_def: "重複定義",
	missing_title: "H1", missing_section: "節が無い", section_order: "節の順番", duplicate_section: "節の重複",
	missing_subheading: "小見出しが無い", retreat_empty: "小節に番号が無い", zero_phrase: "§0 の項目",
	no_s8_mention: "言及が無い", no_tentative: "名前の行が無い", numbering_gap: "番号の抜け", missing_priority: "優先度が無い",
	emoji: "絵文字", heading_text: "見出しの文言", extra_h2: "一覧に無い H2", no_placeholder: "欄が無い",
	unknown_prefix: "未知の接頭辞", excluded_ref: "除いた参照",
};
const GROUPS: { level: Level; title: string; open: boolean }[] = [
	{ level: "violation", title: "違反", open: true },
	{ level: "caution", title: "注意", open: true },
	{ level: "info", title: "情報", open: false },
];

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const profileText = (r: CheckResult) => (r.profile === "contract" ? "契約型" : "汎用型");

export class SpecLintView extends ItemView {
	private expanded = new Map<string, boolean>();   // open という名前の欄は View の内部と被るので使わない

	constructor(leaf: WorkspaceLeaf, private readonly plugin: SpecLintPlugin) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return "仕様書の検査"; }
	getIcon(): string { return "list-checks"; }

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const p = this.plugin;
		const root = this.contentEl;
		root.empty();
		root.addClass("sl-panel");
		const btn = root.createEl("button", { text: "検査し直す" });
		btn.addEventListener("click", () => void p.check());
		if (p.settingsProblem) root.createDiv({ cls: "sl-warn", text: "設定(data.json)が読めないので既定値で動いている。data.json は書き換えていない" });
		const rulesPath = p.settings.rulesNotePath;
		const s = p.state;
		switch (s.kind) {
			case "unset":
				root.createDiv({ cls: "sl-warn", text: "規則ノートのパスが未設定。設定 → Spec Lint の「規則ノートのパス」で指定する" });
				root.createDiv({ cls: "sl-note", text: "規則ノートが決まるまで、検査を1つもしない" });
				return;
			case "none":
				root.createDiv({ cls: "sl-line", text: "対象外: 何も開いていない" });
				return;
			case "out":
				root.createDiv({ cls: "sl-line", text: `対象外(${s.reason}): ${s.path}` });
				return;
			case "idle":
				root.createDiv({ cls: "sl-line", text: `仕様書: ${s.path}` });
				root.createDiv({ cls: "sl-note", text: "自動検査は切ってある。「検査し直す」かコマンドで検査する" });
				return;
			case "rulesError":
				root.createDiv({ cls: "sl-line", text: `仕様書: ${s.path}` });
				root.createDiv({ cls: "sl-line", text: `規則: ${rulesPath}` });
				root.createDiv({ cls: "sl-warn", text: `${s.error.reason}${s.error.item ? ": " + s.error.item : ""}` });
				root.createDiv({ cls: "sl-note", text: "規則ノートが読めないので、検査を1つもしていない" });
				return;
			case "done":
				this.renderResult(root, s.result, s.at, rulesPath, s.rulesUpdated, s.slotSection);
		}
	}

	private renderResult(root: HTMLElement, r: CheckResult, at: Date, rulesPath: string, updated: string, slotSection: string): void {
		const count = (l: Level) => r.findings.filter((f) => f.level === l).length;
		root.createDiv({ cls: "sl-line", text: `仕様書: ${r.path}(${profileText(r)})` });
		root.createDiv({ cls: "sl-line", text: `規則: ${rulesPath}(updated ${updated})` });
		const slots = r.profile === "contract" ? `§${slotSection} の欄 ${r.placeholders} 個` : `§${slotSection} の欄 —(汎用型)`;
		root.createDiv({ cls: "sl-line sl-totals",
			text: `検査: ${clock(at)}(所要 ${r.ms} ms)/ ${slots} / 違反 ${count("violation")}・注意 ${count("caution")}・情報 ${count("info")}` });
		if (!this.plugin.settings.autoCheck) root.createDiv({ cls: "sl-note", text: "自動検査は切ってある" });

		for (const g of GROUPS) {
			const list = r.findings.filter((f) => f.level === g.level);
			const title = `${g.title}(${list.length})${g.level === "info" ? "  他文書参照として除いた参照" : ""}`;
			const body = this.fold(root, g.level, g.open, title);
			for (const f of list) this.row(body, f, r.path);
		}
		const rest = r.undecided.length + r.failed.length > 0;
		const body = this.fold(root, "rest", rest, `判定していない検査(${r.undecided.length}) / 落ちた検査(${r.failed.length})`);
		for (const u of r.undecided) body.createDiv({ cls: "sl-row", text: `判定していない: ${u}` });
		for (const f of r.failed) body.createDiv({ cls: "sl-row sl-warn", text: `落ちた検査: ${f.check}: ${f.message}` });
	}

	/** 畳める組。開け閉めは key で覚える */
	private fold(parent: HTMLElement, key: string, defaultOpen: boolean, title: string): HTMLElement {
		const det = parent.createEl("details", { cls: "sl-group" });
		det.open = this.expanded.get(key) ?? defaultOpen;
		det.addEventListener("toggle", () => this.expanded.set(key, det.open));
		det.createEl("summary", { text: title });
		return det;
	}

	/** 指摘の1行。行があれば押すとその行へ移る */
	private row(parent: HTMLElement, f: Finding, path: string): void {
		const el = parent.createDiv({ cls: "sl-row" });
		el.createSpan({ cls: "sl-kind", text: LABEL[f.kind] });
		el.createSpan({ cls: "sl-text", text: f.productName ? `${f.text}(${f.productName})` : f.text });
		if (f.line === undefined) return;
		const line = f.line;
		el.createSpan({ cls: "sl-lineno", text: `行 ${line + 1}` });
		el.addClass("sl-link");
		el.setAttrs({ role: "button", tabindex: "0", title: `${path}(行 ${line + 1})` });
		const go = () => void openAt(this.app, path, line);
		el.addEventListener("click", go);
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter") go();
		});
	}
}
