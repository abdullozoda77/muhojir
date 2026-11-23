import 'package:material_ui/material_ui.dart';

class AppColors {
  static const background = Color(0xFF0A0A0B);
  static const surface = Color(0xFF141416);
  static const raised = Color(0xFF1C1C1F);
  static const line = Color(0xFF232327);
  static const text = Color(0xFFF4F4F5);
  static const muted = Color(0xFF8E8E96);
  static const faint = Color(0xFF5C5C64);
  static const accent = Color(0xFF4ADE80);
  static const accentSoft = Color(0x1A4ADE80);
  static const warning = Color(0xFFFBBF24);
  static const warningSoft = Color(0x1AFBBF24);
  static const danger = Color(0xFFF87171);
  static const dangerSoft = Color(0x1AF87171);
}

const font = 'Onest';

ThemeData buildTheme() {
  const scheme = ColorScheme.dark(
    primary: AppColors.text,
    onPrimary: AppColors.background,
    secondary: AppColors.accent,
    onSecondary: AppColors.background,
    tertiary: AppColors.accent,
    error: AppColors.danger,
    surface: AppColors.background,
    onSurface: AppColors.text,
    onSurfaceVariant: AppColors.muted,
    surfaceContainerLowest: AppColors.background,
    surfaceContainerLow: AppColors.surface,
    surfaceContainer: AppColors.surface,
    surfaceContainerHigh: AppColors.raised,
    surfaceContainerHighest: AppColors.raised,
    outline: AppColors.line,
    outlineVariant: AppColors.line,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: Brightness.dark, fontFamily: font);
  final field = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none);

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.background,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.white.withValues(alpha: 0.03),
    textTheme: base.textTheme.apply(bodyColor: AppColors.text, displayColor: AppColors.text, fontFamily: font),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      centerTitle: false,
      titleSpacing: 20,
      iconTheme: IconThemeData(color: AppColors.text),
      titleTextStyle: TextStyle(fontFamily: font, fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.text),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Colors.transparent,
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontFamily: font,
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: states.contains(WidgetState.selected) ? AppColors.text : AppColors.faint,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected) ? AppColors.text : AppColors.faint,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: field,
      enabledBorder: field,
      focusedBorder: field.copyWith(borderSide: const BorderSide(color: AppColors.faint)),
      errorBorder: field.copyWith(borderSide: const BorderSide(color: AppColors.danger)),
      focusedErrorBorder: field.copyWith(borderSide: const BorderSide(color: AppColors.danger)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(color: AppColors.faint, fontWeight: FontWeight.w400),
      prefixIconColor: AppColors.faint,
      suffixIconColor: AppColors.faint,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.text,
        foregroundColor: AppColors.background,
        disabledBackgroundColor: AppColors.raised,
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontFamily: font, fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.text,
        backgroundColor: AppColors.surface,
        side: BorderSide.none,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontFamily: font, fontSize: 15, fontWeight: FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.muted,
        textStyle: const TextStyle(fontFamily: font, fontSize: 14, fontWeight: FontWeight.w500),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      dragHandleColor: AppColors.faint,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      titleTextStyle: const TextStyle(fontFamily: font, fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.text),
    ),
    datePickerTheme: const DatePickerThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      headerBackgroundColor: AppColors.surface,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.text,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      contentTextStyle: const TextStyle(fontFamily: font, color: AppColors.background, fontWeight: FontWeight.w500),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.line, space: 1, thickness: 1),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.text),
  );
}
