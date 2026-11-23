import 'package:material_ui/material_ui.dart';

class AppColors {
  static const background = Color(0xFF070D1E);
  static const surface = Color(0xFF0A1228);
  static const containerLow = Color(0xFF101B38);
  static const container = Color(0xFF152242);
  static const containerHigh = Color(0xFF1D2C50);
  static const containerHighest = Color(0xFF283962);
  static const primary = Color(0xFF84A4FF);
  static const onPrimary = Color(0xFF0C1638);
  static const primaryContainer = Color(0xFF345CD2);
  static const gold = Color(0xFFDEB86E);
  static const green = Color(0xFF6EDC8C);
  static const greenContainer = Color(0xFF14301E);
  static const warning = Color(0xFFFACC15);
  static const warningContainer = Color(0xFF34280C);
  static const error = Color(0xFFFC6E6E);
  static const errorContainer = Color(0xFF401618);
  static const text = Color(0xFFECF0F8);
  static const textMuted = Color(0xFFA0ACC8);
  static const outline = Color(0xFF6C7CA0);
  static const outlineVariant = Color(0xFF1E2D52);
}

ThemeData buildTheme() {
  const scheme = ColorScheme.dark(
    primary: AppColors.primary,
    onPrimary: AppColors.onPrimary,
    primaryContainer: AppColors.primaryContainer,
    onPrimaryContainer: Color(0xFFECF1FF),
    secondary: AppColors.gold,
    onSecondary: Color(0xFF2E1800),
    tertiary: AppColors.green,
    error: AppColors.error,
    errorContainer: AppColors.errorContainer,
    surface: AppColors.surface,
    onSurface: AppColors.text,
    onSurfaceVariant: AppColors.textMuted,
    surfaceContainerLowest: AppColors.background,
    surfaceContainerLow: AppColors.containerLow,
    surfaceContainer: AppColors.container,
    surfaceContainerHigh: AppColors.containerHigh,
    surfaceContainerHighest: AppColors.containerHighest,
    outline: AppColors.outline,
    outlineVariant: AppColors.outlineVariant,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: Brightness.dark);
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(16),
    borderSide: const BorderSide(color: AppColors.outlineVariant),
  );

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.text),
    ),
    cardTheme: CardThemeData(
      color: AppColors.containerLow,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.outlineVariant),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.primaryContainer,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? AppColors.text : AppColors.textMuted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? Colors.white : AppColors.textMuted,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.containerLow,
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      hintStyle: const TextStyle(color: AppColors.textMuted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppColors.containerLow,
      selectedColor: AppColors.primaryContainer,
      side: const BorderSide(color: AppColors.outlineVariant),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.containerHighest,
      contentTextStyle: TextStyle(color: AppColors.text),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.outlineVariant, space: 1),
  );
}
