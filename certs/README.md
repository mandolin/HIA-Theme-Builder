# 代码签名证书

本目录包含项目自签名代码签名证书。

## 证书信息

- **文件**：`hia-theme-builder.pfx`
- **密码**：`hia-2026`（通过环境变量 `WIN_CSC_KEY_PASSWORD` 传递）
- **Thumbprint**：`E68466AD564223C2B5E9FEA02BBE9166D9A39DA6`
- **主题**：`CN=HIA Theme Builder, O=HIA, L=Beijing, C=CN`
- **有效期**：3 年（至 2029-11-06）
- **类型**：自签名（不会被 Windows 默认信任）

## 用途

用于 Electron 和 Tauri 桌面端安装器/便携版的代码签名。

**注意**：自签名证书不会消除 Windows SmartScreen 的"未知发布者"警告，但技术上已完成签名。若需消除警告，需采购 OV/EV 商业证书。

## 重新生成

若需重新生成证书：

```powershell
# 创建自签名证书
New-SelfSignedCertificate -Type Custom -Subject 'CN=HIA Theme Builder, O=HIA, L=Beijing, C=CN' -KeyUsage DigitalSignature -CertStoreLocation 'Cert:\CurrentUser\My' -FriendlyName 'HIA Theme Builder Code Signing' -NotAfter (Get-Date).AddYears(3)

# 导出为 PFX（替换 <thumbprint> 为上一步输出的 Thumbprint）
Export-PfxCertificate -Cert "Cert:\CurrentUser\My\<thumbprint>" -FilePath 'certs\hia-theme-builder.pfx' -Password (ConvertTo-SecureString -String 'hia-2026' -Force -AsPlainText)
```

## 构建使用

### Electron

```bash
cd HIA/electron
WIN_CSC_KEY_PASSWORD=hia-2026 npm run dist
```

### Tauri

Tauri 使用证书库中的证书（无需密码）：

```bash
cd HIA/tauri
npm run build
```

证书已导入到 `Cert:\CurrentUser\My`，Tauri 通过 `certificateThumbprint` 引用。
