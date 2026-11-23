import 'package:flutter_test/flutter_test.dart';
import 'package:muhojir/format.dart';

void main() {
  test('money groups thousands', () {
    expect(money(43000), '43 000');
    expect(money(1250000), '1 250 000');
  });

  test('salary shows range and period', () {
    expect(salary({'salary_from': 75600, 'salary_to': 96800, 'salary_period': 'month'}), '75 600 – 96 800 ₽/моҳ');
    expect(salary({'salary_from': 3000, 'salary_period': 'day'}), 'аз 3 000 ₽/рӯз');
    expect(salary({}), 'Маош бо мусоҳиба');
  });

  test('rent price', () {
    expect(rentPrice({'price': 43000, 'period': 'month'}), '43 000 ₽/моҳ');
    expect(rentPrice({'price': null}), 'Нарх бо гуфтугӯ');
  });
}
