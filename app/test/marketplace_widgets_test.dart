import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketkit/features/marketplace/widgets/profile_empty_row.dart';
import 'package:marketkit/features/marketplace/widgets/profile_loading_row.dart';
import 'package:marketkit/features/marketplace/widgets/wallet_action_button.dart';

/// Widget tests for the pieces lifted out of market_profile_tab.
///
/// They were private classes inside a 713-line screen, reachable only by
/// building the whole tab with its providers. Now that each is its own public
/// widget it can be pumped on its own, which is the point of the split.

Widget wrap(Widget child) => MaterialApp(
      home: Scaffold(body: Row(children: [child])),
    );

void main() {
  group('ProfileEmptyRow', () {
    testWidgets('shows the message it is given', (tester) async {
      await tester.pumpWidget(wrap(const ProfileEmptyRow(text: 'No purchases yet')));

      expect(find.text('No purchases yet'), findsOneWidget);
    });
  });

  group('ProfileLoadingRow', () {
    testWidgets('shows a progress indicator', (tester) async {
      await tester.pumpWidget(wrap(const ProfileLoadingRow()));

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('WalletActionButton', () {
    testWidgets('renders its icon and label', (tester) async {
      await tester.pumpWidget(wrap(
        WalletActionButton(icon: Icons.add, label: 'Add Money', onTap: () {}),
      ));

      expect(find.text('Add Money'), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);
    });

    testWidgets('reports taps', (tester) async {
      var taps = 0;
      await tester.pumpWidget(wrap(
        WalletActionButton(icon: Icons.add, label: 'Add Money', onTap: () => taps++),
      ));

      await tester.tap(find.byType(WalletActionButton));
      await tester.pump();

      expect(taps, 1);
    });
  });
}
