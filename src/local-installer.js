/**
 * ローカルインストーラー機能
 * cli.js 2368-2377行から復元
 */

const path = require('path');
const os = require('os');

// インストール設定
const INSTALL_CONFIG = {
  PACKAGE_URL: "@anthropic-ai/claude-code",
  VERSION: "1.0.43",
  LOCAL_INSTALL_PATH: path.join(os.homedir(), '.claude', 'local'),
  ISSUES_EXPLAINER: "report the issue at https://github.com/anthropics/claude-code/issues",
  README_URL: "https://docs.anthropic.com/s/claude-code"
};

/**
 * ローカルインストーラーのメインステートマシン
 */
class LocalInstaller {
  constructor() {
    this.state = "intro";
    this.errorMessage = "";
    this.aliasInstructions = "";
  }

  /**
   * インストールプロセスを開始
   */
  async startInstallation() {
    try {
      // ローカルパッケージ作成チェック
      if (!await this.createLocalPackage()) {
        this.errorMessage = "Local package creation failed";
        this.state = "error";
        this.sendTelemetry("failure", "environement_setup");
        return;
      }

      // メインインストール処理
      const result = await this.performInstallation();
      
      switch (result) {
        case "success":
          this.state = "success";
          this.sendTelemetry("success");
          break;
          
        case "in_progress":
          this.errorMessage = "Update already in progress";
          this.state = "error";
          this.sendTelemetry("failure", "in_progress");
          break;
          
        case "install_failed":
          this.errorMessage = `Install of ${INSTALL_CONFIG.PACKAGE_URL} failed`;
          this.state = "error";
          this.sendTelemetry("failure", "other_failure");
          break;
      }
      
    } catch (error) {
      this.errorMessage = String(error);
      this.state = "error";
      this.sendTelemetry("failure", "unexpected_error");
    }
  }

  /**
   * シェルエイリアス設定
   */
  async setupAlias() {
    try {
      this.state = "setup-alias";
      const instructions = await this.generateAliasInstructions();
      this.aliasInstructions = instructions;
      this.state = "setup";
    } catch (error) {
      this.errorMessage = String(error);
      this.state = "error";
    }
  }

  /**
   * グローバルnpmパッケージのアンインストール
   */
  async uninstallGlobal() {
    try {
      this.state = "uninstall";
      
      const success = await this.removeGlobalPackage();
      
      if (success) {
        this.state = "uninstall-success";
      } else {
        this.state = "uninstall-failed";
      }
      
    } catch (error) {
      this.errorMessage = String(error);
      this.state = "uninstall-failed";
    }
  }

  /**
   * ローカルパッケージ作成
   */
  async createLocalPackage() {
    try {
      // ~/.claude/local ディレクトリ作成
      await this.ensureDirectory(INSTALL_CONFIG.LOCAL_INSTALL_PATH);
      
      // パッケージファイルをローカルにコピー
      await this.copyPackageFiles();
      
      return true;
    } catch (error) {
      console.error("Failed to create local package:", error);
      return false;
    }
  }

  /**
   * メインインストール処理
   */
  async performInstallation() {
    try {
      // インストール状態チェック
      if (await this.isInstallationInProgress()) {
        return "in_progress";
      }
      
      // 実際のインストール処理
      const installResult = await this.executeInstallation();
      
      if (installResult.success) {
        return "success";
      } else {
        return "install_failed";
      }
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * エイリアス指示生成
   */
  async generateAliasInstructions() {
    const shell = this.detectShell();
    const aliasCommand = `alias claude="${path.join(INSTALL_CONFIG.LOCAL_INSTALL_PATH, 'bin', 'claude')}"`;
    
    let configFile;
    switch (shell) {
      case 'zsh':
        configFile = '~/.zshrc';
        break;
      case 'bash':
        configFile = '~/.bashrc';
        break;
      case 'fish':
        configFile = '~/.config/fish/config.fish';
        break;
      default:
        configFile = '~/.bashrc';
    }
    
    return `
Add this line to your ${configFile}:

${aliasCommand}

Then restart your shell or run:
source ${configFile}
`;
  }

  /**
   * グローバルパッケージ削除
   */
  async removeGlobalPackage() {
    try {
      const command = `npm uninstall -g --force ${INSTALL_CONFIG.PACKAGE_URL}`;
      const result = await this.executeCommand(command);
      return result.code === 0;
    } catch (error) {
      console.error("Failed to remove global package:", error);
      return false;
    }
  }

  /**
   * 現在の状態取得
   */
  getState() {
    return {
      state: this.state,
      errorMessage: this.errorMessage,
      aliasInstructions: this.aliasInstructions,
      installPath: INSTALL_CONFIG.LOCAL_INSTALL_PATH,
      packageUrl: INSTALL_CONFIG.PACKAGE_URL,
      version: INSTALL_CONFIG.VERSION
    };
  }

  // ヘルパーメソッド
  async ensureDirectory(dirPath) {
    const fs = require('fs').promises;
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async copyPackageFiles() {
    // 実装: パッケージファイルのコピー処理
    console.log(`Copying package files to ${INSTALL_CONFIG.LOCAL_INSTALL_PATH}`);
  }

  async isInstallationInProgress() {
    // 実装: インストール進行中チェック
    return false;
  }

  async executeInstallation() {
    // 実装: 実際のインストール処理
    return { success: true };
  }

  detectShell() {
    return process.env.SHELL?.split('/').pop() || 'bash';
  }

  async executeCommand(command) {
    // 実装: コマンド実行
    return { code: 0, stdout: "", stderr: "" };
  }

  sendTelemetry(status, reason = null) {
    const eventData = { status };
    if (reason) {
      eventData.reason = reason;
    }
    console.log("Local installer telemetry:", eventData);
  }
}

/**
 * UI ステート管理
 */
class LocalInstallerUI {
  constructor(installer) {
    this.installer = installer;
  }

  /**
   * 現在の状態に基づいてUIを描画
   */
  render() {
    const state = this.installer.getState();
    
    switch (state.state) {
      case "intro":
        return this.renderIntro();
        
      case "installing":
        return this.renderInstalling(state);
        
      case "success":
        return this.renderSuccess();
        
      case "setup-alias":
        return this.renderSetupAlias();
        
      case "setup":
        return this.renderSetup(state);
        
      case "uninstall":
        return this.renderUninstall();
        
      case "uninstall-success":
        return this.renderUninstallSuccess(state);
        
      case "uninstall-failed":
        return this.renderUninstallFailed(state);
        
      case "error":
        return this.renderError(state);
    }
  }

  renderIntro() {
    return {
      title: "Claude Local Installer",
      message: `This will install Claude to ~/.claude/local instead of using a global npm installation.`,
      actions: ["Press Enter to continue or Esc to exit"]
    };
  }

  renderInstalling(state) {
    return {
      title: "Installing Claude locally...",
      message: `Installing to ${state.installPath}`,
      showSpinner: true
    };
  }

  renderSuccess() {
    return {
      title: "✓ Local installation successful!",
      message: "Next, let's add an alias for `claude`",
      actions: ["Press Enter to continue or Esc to exit"]
    };
  }

  renderSetupAlias() {
    return {
      title: "Setting up alias for claude...",
      message: "Configuring shell environment",
      showSpinner: true
    };
  }

  renderSetup(state) {
    return {
      title: "Alias setup complete",
      message: state.aliasInstructions + "\n\nNext, we'll remove the globally installed npm package",
      actions: ["Press Enter to continue or Esc to exit"]
    };
  }

  renderUninstall() {
    return {
      title: "Uninstalling global Claude...",
      message: "Removing global npm installation",
      showSpinner: true
    };
  }

  renderUninstallSuccess(state) {
    return {
      title: "✓ Global installation removed successfully!",
      message: `Claude is now installed locally.\nPlease restart your shell, then run claude.\n\n🎉 Happy Clauding!`,
      actions: ["Press Enter to exit"]
    };
  }

  renderUninstallFailed(state) {
    return {
      title: "! Could not remove global installation",
      message: `The local installation is installed, but we couldn't remove the global npm package automatically.\n\nYou can remove it manually later with:\nnpm uninstall -g --force ${state.packageUrl}`,
      actions: ["Press Enter to exit"]
    };
  }

  renderError(state) {
    return {
      title: "✗ Installation failed",
      message: state.errorMessage || "An unexpected error occurred during installation.",
      actions: ["Press Enter to exit"]
    };
  }
}

module.exports = {
  LocalInstaller,
  LocalInstallerUI,
  INSTALL_CONFIG
};