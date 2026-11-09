import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/main.dart';

void main() {
  for (var i=0; i<10; i++) {
    testWidgets('Captura real Elo tela ${i + 1}', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      await tester.pumpWidget(EloApp(initialPage:i));
      await tester.pumpAndSettle();
      final n=(i+1).toString().padLeft(2,'0');
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/elo_tela_$n.png'));
      await tester.binding.setSurfaceSize(null);
    });
  }
}
