
/**
 * 共用Widget元件_1.0.0
 * @module 展示層共用元件
 * @description LCAS 2.0 通用UI元件庫 - 可重複使用的界面元件
 * @update 2025-01-31: 建立v1.0.0版本，實作基礎共用元件
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// 狀態管理導入
import '9605. user_mode_provider.dart';
import '9602. theme_manager.dart';

/**
 * 01. LCAS按鈕元件
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 統一風格的按鈕元件，支援四模式主題
 */
class LCASButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isSecondary;
  final IconData? icon;
  final double? width;
  final double? height;
  final EdgeInsetsGeometry? padding;
  
  const LCASButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isSecondary = false,
    this.icon,
    this.width,
    this.height,
    this.padding,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final userMode = context.read<UserModeProvider>().currentMode;
    
    return Container(
      width: width,
      height: height ?? 48,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isSecondary 
              ? theme.colorScheme.secondary
              : theme.colorScheme.primary,
          foregroundColor: isSecondary
              ? theme.colorScheme.onSecondary  
              : theme.colorScheme.onPrimary,
          padding: padding ?? const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          ),
          elevation: _getElevation(userMode),
        ),
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isSecondary 
                        ? theme.colorScheme.onSecondary
                        : theme.colorScheme.onPrimary,
                  ),
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    text,
                    style: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
  
  /**
   * 02. 根據使用者模式取得圓角半徑
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:30:00
   * @update: 不同模式使用不同的視覺風格
   */
  double _getBorderRadius(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return 4.0; // 較方正的設計
      case UserMode.recordKeeper:
        return 12.0; // 圓潤的設計
      case UserMode.transformChallenger:
        return 8.0; // 動感的設計
      case UserMode.potentialAwakener:
        return 16.0; // 親和的設計
    }
  }
  
  /**
   * 03. 根據使用者模式取得陰影深度
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:30:00
   * @update: 不同模式使用不同的陰影效果
   */
  double _getElevation(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return 1.0; // 扁平化設計
      case UserMode.recordKeeper:
        return 4.0; // 柔和陰影
      case UserMode.transformChallenger:
        return 6.0; // 強烈陰影
      case UserMode.potentialAwakener:
        return 2.0; // 輕微陰影
    }
  }
}

/**
 * 04. LCAS輸入框元件
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 統一風格的輸入框元件
 */
class LCASTextField extends StatelessWidget {
  final String? label;
  final String? hintText;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final bool obscureText;
  final bool enabled;
  final int? maxLines;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final EdgeInsetsGeometry? contentPadding;
  
  const LCASTextField({
    super.key,
    this.label,
    this.hintText,
    this.controller,
    this.onChanged,
    this.validator,
    this.keyboardType,
    this.obscureText = false,
    this.enabled = true,
    this.maxLines = 1,
    this.prefixIcon,
    this.suffixIcon,
    this.contentPadding,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final userMode = context.read<UserModeProvider>().currentMode;
    
    return TextFormField(
      controller: controller,
      onChanged: onChanged,
      validator: validator,
      keyboardType: keyboardType,
      obscureText: obscureText,
      enabled: enabled,
      maxLines: maxLines,
      style: theme.textTheme.bodyLarge,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        prefixIcon: prefixIcon != null ? Icon(prefixIcon) : null,
        suffixIcon: suffixIcon,
        contentPadding: contentPadding ?? const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          borderSide: BorderSide(
            color: theme.colorScheme.outline,
            width: 1.0,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          borderSide: BorderSide(
            color: theme.colorScheme.outline.withOpacity(0.5),
            width: 1.0,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          borderSide: BorderSide(
            color: theme.colorScheme.primary,
            width: 2.0,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          borderSide: BorderSide(
            color: theme.colorScheme.error,
            width: 1.0,
          ),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          borderSide: BorderSide(
            color: theme.colorScheme.outline.withOpacity(0.3),
            width: 1.0,
          ),
        ),
        filled: true,
        fillColor: enabled 
            ? theme.colorScheme.surface
            : theme.colorScheme.surface.withOpacity(0.5),
      ),
    );
  }
  
  double _getBorderRadius(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return 4.0;
      case UserMode.recordKeeper:
        return 12.0;
      case UserMode.transformChallenger:
        return 8.0;
      case UserMode.potentialAwakener:
        return 16.0;
    }
  }
}

/**
 * 05. LCAS卡片元件
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 統一風格的卡片容器元件
 */
class LCASCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final double? elevation;
  
  const LCASCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.backgroundColor,
    this.elevation,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final userMode = context.read<UserModeProvider>().currentMode;
    
    return Container(
      margin: margin ?? const EdgeInsets.all(8.0),
      child: Material(
        color: backgroundColor ?? theme.colorScheme.surface,
        elevation: elevation ?? _getElevation(userMode),
        borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(_getBorderRadius(userMode)),
          child: Container(
            padding: padding ?? const EdgeInsets.all(16.0),
            child: child,
          ),
        ),
      ),
    );
  }
  
  double _getBorderRadius(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return 8.0;
      case UserMode.recordKeeper:
        return 16.0;
      case UserMode.transformChallenger:
        return 12.0;
      case UserMode.potentialAwakener:
        return 20.0;
    }
  }
  
  double _getElevation(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return 2.0;
      case UserMode.recordKeeper:
        return 4.0;
      case UserMode.transformChallenger:
        return 6.0;
      case UserMode.potentialAwakener:
        return 3.0;
    }
  }
}

/**
 * 06. 載入中指示器
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 統一的載入狀態指示器
 */
class LCASLoading extends StatelessWidget {
  final String? message;
  final double? size;
  
  const LCASLoading({
    super.key,
    this.message,
    this.size,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: size ?? 40,
            height: size ?? 40,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(
                theme.colorScheme.primary,
              ),
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withOpacity(0.7),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}

/**
 * 07. 錯誤顯示元件
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 統一的錯誤狀態顯示
 */
class LCASErrorWidget extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final IconData? icon;
  
  const LCASErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.icon,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon ?? Icons.error_outline,
              size: 64,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              LCASButton(
                text: '重試',
                onPressed: onRetry,
                icon: Icons.refresh,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/**
 * 08. 空狀態顯示元件
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 統一的空數據狀態顯示
 */
class LCASEmptyState extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? action;
  
  const LCASEmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.action,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon ?? Icons.inbox_outlined,
              size: 64,
              color: theme.colorScheme.onSurface.withOpacity(0.5),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: theme.textTheme.headlineSmall?.copyWith(
                color: theme.colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: 24),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/**
 * 09. 模式切換指示器
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:30:00
 * @update: 顯示當前使用者模式的視覺指示器
 */
class ModeIndicator extends StatelessWidget {
  final bool showLabel;
  final double? size;
  
  const ModeIndicator({
    super.key,
    this.showLabel = true,
    this.size,
  });
  
  @override
  Widget build(BuildContext context) {
    return Consumer<UserModeProvider>(
      builder: (context, userModeProvider, child) {
        final modeInfo = userModeProvider.getModeDisplayInfo(
          userModeProvider.currentMode,
        );
        
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            gradient: modeInfo['gradient'] as LinearGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                modeInfo['icon'] as IconData,
                color: Colors.white,
                size: size ?? 16,
              ),
              if (showLabel) ...[
                const SizedBox(width: 6),
                Text(
                  modeInfo['name'] as String,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: size != null ? size! * 0.8 : 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
