"""Direct-mode tests for the Sportsbook contract.

Run with: `pytest tests/direct/ -v`
"""

import json
import time


def _future_unix(seconds_ahead: int = 3600) -> int:
    return int(time.time()) + seconds_ahead


def test_create_market_assigns_incrementing_ids(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/sportsbook.py")
    direct_vm.sender = direct_alice

    a = contract.create_market(
        "Brazil", "Argentina", "Copa",
        "https://www.bbc.com/sport/football/scores-fixtures/2099-01-01",
        _future_unix(),
    )
    b = contract.create_market(
        "Real Madrid", "Barcelona", "La Liga",
        "https://www.bbc.com/sport/football/scores-fixtures/2099-02-02",
        _future_unix(),
    )
    assert a == 1
    assert b == 2

    m = contract.get_market(1)
    assert m["home"] == "Brazil"
    assert m["resolved"] is False


def test_place_bet_grows_pools(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/sportsbook.py")
    direct_vm.sender = direct_alice
    mid = contract.create_market(
        "PSG", "Marseille", "Ligue 1",
        "https://www.bbc.com/sport/football/scores-fixtures/2099-03-03",
        _future_unix(),
    )

    # Alice backs HOME with 10 GEN
    direct_vm.sender = direct_alice
    direct_vm.value = 10 * 10**18
    contract.place_bet(mid, 0)

    # Bob backs AWAY with 5 GEN
    direct_vm.sender = direct_bob
    direct_vm.value = 5 * 10**18
    contract.place_bet(mid, 2)

    m = contract.get_market(mid)
    assert int(m["pool_home"]) == 10 * 10**18
    assert int(m["pool_away"]) == 5 * 10**18
    assert int(m["pool_draw"]) == 0


def test_resolve_and_claim_pays_winner(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/sportsbook.py")
    direct_vm.sender = direct_alice
    mid = contract.create_market(
        "Brazil", "Jamaica", "Friendly",
        "https://www.bbc.com/sport/football/scores-fixtures/2099-06-05",
        _future_unix(),
    )

    direct_vm.sender = direct_alice
    direct_vm.value = 10 * 10**18
    bet_id = contract.place_bet(mid, 0)  # HOME

    direct_vm.sender = direct_bob
    direct_vm.value = 5 * 10**18
    contract.place_bet(mid, 2)  # AWAY

    # Mock the LLM extraction: HOME wins 3:0
    direct_vm.mock_web(r".*bbc\.com/sport/.*", {"status": 200, "body": "<html>Brazil 3-0 Jamaica</html>"})
    direct_vm.mock_llm(r".*final result.*", json.dumps({"winner": 0, "score": "3:0"}))

    decision = contract.resolve(mid)
    assert decision["resolved"] is True
    assert decision["winner"] == 0

    # Alice claims — she should get the entire 15 GEN pool (pari-mutuel, sole winner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    payout = contract.claim(bet_id)
    assert payout == 15 * 10**18


def test_late_bet_rejected_after_kickoff(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/sportsbook.py")
    direct_vm.sender = direct_alice
    past_kickoff = int(time.time()) - 60
    mid = contract.create_market(
        "X", "Y", "Test",
        "https://example.com/results",
        past_kickoff,
    )

    direct_vm.value = 1 * 10**18
    with direct_vm.expect_revert("market is closed"):
        contract.place_bet(mid, 0)
