"""Direct-mode tests for the Casino contract.

Run with: `pytest tests/direct/ -v`

Note: the casino RNG mixes the transaction datetime, sender, contract address,
and a monotonic nonce. Tests assert on round shape rather than specific
outcomes — exact outcomes are exercised in integration tests where seeding
across validators matters.
"""


def test_fund_house_increases_bankroll(direct_vm, direct_deploy, direct_owner):
    contract = direct_deploy("contracts/casino.py")
    direct_vm.sender = direct_owner
    direct_vm.value = 1_000 * 10**18
    contract.fund_house()
    assert int(contract.house_balance()) == 1_000 * 10**18


def test_coinflip_returns_round_shape(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy("contracts/casino.py")

    direct_vm.sender = direct_owner
    direct_vm.value = 1_000 * 10**18
    contract.fund_house()

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    result = contract.play_coinflip(True)
    assert result["round_id"] == 1
    assert "seed_hex" in result and len(result["seed_hex"]) == 64
    assert result["detail"]["called"] == "heads"
    assert result["detail"]["landed"] in ("heads", "tails")
    assert result["detail"]["won"] in (True, False)


def test_dice_rejects_out_of_range_target(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy("contracts/casino.py")
    direct_vm.sender = direct_owner
    direct_vm.value = 1_000 * 10**18
    contract.fund_house()

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    with direct_vm.expect_revert("target_under must be in"):
        contract.play_dice(1)
    with direct_vm.expect_revert("target_under must be in"):
        contract.play_dice(96)


def test_roulette_records_spin(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy("contracts/casino.py")
    direct_vm.sender = direct_owner
    direct_vm.value = 10_000 * 10**18
    contract.fund_house()

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    result = contract.play_roulette("red", 0)
    spin = result["detail"]["spin"]
    assert 0 <= spin <= 36
    assert result["detail"]["color"] in ("red", "black", "green")


def test_slots_returns_three_reels(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy("contracts/casino.py")
    direct_vm.sender = direct_owner
    direct_vm.value = 100_000 * 10**18
    contract.fund_house()

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    result = contract.play_slots()
    reels = result["detail"]["reels"]
    assert len(reels) == 3
    for s in reels:
        assert s in ("7", "BAR", "BELL", "CHERRY", "LEMON", "PLUM")


def test_undercapitalised_house_rejects_bet(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy("contracts/casino.py")
    direct_vm.sender = direct_owner
    direct_vm.value = 5 * 10**18  # tiny bankroll
    contract.fund_house()

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18  # tries to bet 1 GEN; max payout exceeds bankroll
    with direct_vm.expect_revert("house bankroll too small"):
        contract.play_slots()


def test_withdraw_only_owner(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy("contracts/casino.py")
    direct_vm.sender = direct_owner
    direct_vm.value = 100 * 10**18
    contract.fund_house()

    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("only owner"):
        contract.withdraw(1)
