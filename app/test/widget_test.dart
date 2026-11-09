import 'package:flutter_test/flutter_test.dart';
import 'package:app/main.dart';

void main() {
  testWidgets('Elo abre e permite chegar ao onboarding', (tester) async {
    await tester.pumpWidget(const EloApp());
    expect(find.text('Elo'), findsOneWidget);
    await tester.tap(find.text('Começar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Bem-vinde ao Elo'), findsOneWidget);
    expect(find.text('Já tenho uma conta'), findsOneWidget);
  });
}
