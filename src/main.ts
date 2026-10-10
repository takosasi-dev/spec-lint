// Spec Lint の入口: ビュー・コマンド2つ・設定タブ・イベント5つを登録し、onLayoutReady で初回の検査をする(§2)。
// 検査の流れ: 規則ノートを読んで確かめ(FR-2)→ 対象か決め(FR-1)→ 開いている仕様書1本を検査する。結果はパネルにだけ出す(INV-12)。
// 検査中に次が来たら、終わってから1回だけ検査し直す(FR-21)。書き込みは saveData() だけ(INV-1)。
import { debounce, normalizePath, Plugin, type TAbstractFile } from "obsidian";
import { runChecks, type CheckResult } from "./check";
import { isTarget } from "./check/profile";
import { isRulesError, parseRules, type RulesError } from "./rules/validate";
import { normalizeSettings, type Settings } from "./settings";
import { SpecLintSettingTab } from "./settings-tab";
import { activeFile, folderPaths, readRulesNote, readSpec } from "./source";
import { SpecLintView, VIEW_TYPE } from "./view";

export type PanelState =
	| { kind: "unset" }                                             // 規則ノートのパスが未設定(規則ノートを探さず、検査もしない)
	| { kind: "none" }                                              // 何も開いていない
	| { kind: "out"; path: string; reason: string }                 // 対象外(FR-1)
	| { kind: "idle"; path: string }                                // 自動検査は切ってある(FR-21)
	| { kind: "rulesError"; path: string; error: RulesError }       // 規則ノートが読めない(FR-2)
	| { kind: "done"; result: CheckResult; at: Date; rulesUpdated: string; slotSection: string };

export default class SpecLintPlugin extends Plugin {
	settings!: Settings;
	/** data.json が壊れていて既定値で動いている(§9.3) */
	settingsProblem = false;
	state: PanelState = { kind: "none" };
	private running = false;
	/** 検査中に来た次の依頼(true は検査、false は対象かを決めるだけ)。無ければ null */
	private queued: boolean | null = null;
	/** 設定を変えたら少し待ってから(1文字ごとに検査しない) */
	private refreshSoon = debounce(() => this.refresh(), 500, true);

	async onload(): Promise<void> {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new SpecLintView(leaf, this));
		this.addCommand({ id: "open-panel", name: "仕様書の検査パネルを開く", callback: () => void this.openPanel() });
		this.addCommand({ id: "recheck", name: "開いている仕様書を検査し直す", callback: () => void this.recheck() });
		this.addSettingTab(new SpecLintSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on("file-open", () => this.onOpened()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.onOpened()));
		this.registerEvent(this.app.metadataCache.on("changed", (file) => this.onChanged(file.path)));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRenamed(file, oldPath)));
		this.registerEvent(this.app.vault.on("delete", (file) => this.onDeleted(file.path)));
		this.register(() => this.refreshSoon.cancel());
		this.app.workspace.onLayoutReady(() => this.refresh());
	}

	/** パネルが出している仕様書のパス */
	shownPath(): string | null {
		const s = this.state;
		return s.kind === "none" || s.kind === "unset" ? null : s.kind === "done" ? s.result.path : s.path;
	}

	/** 自動検査が ON なら検査し、OFF なら対象かだけ決めて「自動検査は切ってある」にする */
	private refresh(): void {
		void this.check(this.settings.autoCheck);
	}

	/** 開くファイルが変わったときだけ(パネルを押しただけでは検査しない) */
	private onOpened(): void {
		if ((activeFile(this.app)?.path ?? null) !== this.shownPath()) this.refresh();
	}

	private onChanged(path: string): void {
		if (!this.settings.autoCheck) return;
		if (path === this.shownPath() || path === this.settings.rulesNotePath) void this.check();   // FR-21・FR-24
	}

	private onRenamed(file: TAbstractFile, oldPath: string): void {
		const rules = this.settings.rulesNotePath;
		if (oldPath === this.shownPath() || oldPath === rules || file.path === rules) this.refresh();
	}

	private onDeleted(path: string): void {
		if (path === this.shownPath()) this.setState({ kind: "out", path, reason: "削除された" });
		else if (path === this.settings.rulesNotePath) this.refresh();
	}

	/** 開いている仕様書を検査する(run=false は対象かを決めるだけ)。検査中に呼ばれたら、終わってから1回だけし直す(FR-21) */
	async check(run = true): Promise<void> {
		if (this.running) {
			this.queued = (this.queued ?? false) || run;
			return;
		}
		this.running = true;
		try {
			let next: boolean | null = run;
			while (next !== null) {
				this.queued = null;
				this.setState(await this.checkOnce(next));
				next = this.queued;
			}
		} finally {
			this.running = false;
		}
	}

	private async checkOnce(run: boolean): Promise<PanelState> {
		const rulesPath = this.settings.rulesNotePath;
		if (rulesPath === "") return { kind: "unset" };
		const file = activeFile(this.app);
		if (!file) return { kind: "none" };
		const note = await readRulesNote(this.app, rulesPath);
		if (note === null) return { kind: "rulesError", path: file.path, error: { reason: "規則ノートが見つからない", item: rulesPath } };
		const rules = parseRules(note);
		if (isRulesError(rules)) return { kind: "rulesError", path: file.path, error: rules };
		if (!isTarget(file.path, file.extension, rules, rulesPath)) {
			return { kind: "out", path: file.path, reason: file.path === rulesPath ? "規則ノート自身" : "仕様書フォルダの md でない" };
		}
		if (!run) return { kind: "idle", path: file.path };
		const text = await readSpec(this.app, file);
		const result = runChecks({ path: file.path, text, folders: folderPaths(this.app) }, rules);
		return { kind: "done", result, at: new Date(), rulesUpdated: rules.updated, slotSection: rules.placeholderSection };
	}

	/** コマンドから。未設定のときは、パネルを出して知らせを見せる(結果はパネルにだけ出す。INV-12) */
	private async recheck(): Promise<void> {
		await this.check();
		if (this.state.kind === "unset") await this.openPanel();
	}

	private setState(s: PanelState): void {
		this.state = s;
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof SpecLintView) leaf.view.render();
		}
	}

	/** 右サイドバーにパネルを出す(§9.5) */
	async openPanel(): Promise<void> {
		await this.app.workspace.ensureSideLeaf(VIEW_TYPE, "right", { active: true, reveal: true });
	}

	async loadSettings(): Promise<void> {
		let raw: unknown = null;
		let broken = false;
		try {
			raw = await this.loadData();
		} catch {
			broken = true;
		}
		const { settings, problem } = normalizeSettings(raw, normalizePath);
		this.settings = settings;
		this.settingsProblem = broken || problem;
	}

	/** 設定タブからだけ呼ぶ。保存したら少し待って検査し直す */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.settingsProblem = false;
		this.refreshSoon();
	}
}
