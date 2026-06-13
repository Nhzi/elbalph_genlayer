# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""ELF — the in-app token used by ELBALPH for bets and settlements.

The bankroll address (the Casino contract) and the faucet address are
authorized infinite minters. The faucet hands every new user 100,000 ELF
to start so they can play without worrying about gas-token economics.

Gasless intent: bets are denominated in ELF, the contract burns/mints to
settle, and the user's GEN balance stays untouched. Validators still need
gas internally — that lives in the contract's bankroll, not the player's
wallet.
"""

from genlayer import *

from dataclasses import dataclass
import typing


FAUCET_AMOUNT = 100_000 * 10**18  # 100,000 ELF in 18-decimal wei


class ElfToken(gl.Contract):
    owner: Address
    total_supply: u256
    balances: TreeMap[Address, u256]
    minters: TreeMap[Address, bool]
    faucet_claimed: TreeMap[Address, bool]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.total_supply = u256(0)
        # Owner is a minter by default; bankroll + faucet get added post-deploy.
        self.minters[self.owner] = True

    # ─────────────────────────── minter management ──────────────────────────

    @gl.public.write
    def add_minter(self, who: Address) -> bool:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("only owner can add minters")
        self.minters[who] = True
        return True

    @gl.public.write
    def remove_minter(self, who: Address) -> bool:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("only owner can remove minters")
        if who in self.minters:
            self.minters[who] = False
        return True

    @gl.public.view
    def is_minter(self, who: Address) -> bool:
        return who in self.minters and bool(self.minters[who])

    # ──────────────────────────────── minting ───────────────────────────────

    @gl.public.write
    def mint(self, to: Address, amount: int) -> bool:
        sender = gl.message.sender_address
        if not (sender in self.minters and bool(self.minters[sender])):
            raise gl.vm.UserError("not authorized to mint")
        if amount <= 0:
            raise gl.vm.UserError("amount must be > 0")
        current = int(self.balances[to]) if to in self.balances else 0
        self.balances[to] = u256(current + amount)
        self.total_supply = u256(int(self.total_supply) + amount)
        return True

    @gl.public.write
    def burn(self, from_addr: Address, amount: int) -> bool:
        sender = gl.message.sender_address
        if not (sender in self.minters and bool(self.minters[sender])):
            raise gl.vm.UserError("not authorized to burn")
        current = int(self.balances[from_addr]) if from_addr in self.balances else 0
        if current < amount:
            raise gl.vm.UserError("insufficient balance")
        self.balances[from_addr] = u256(current - amount)
        self.total_supply = u256(int(self.total_supply) - amount)
        return True

    # ──────────────────────────────── faucet ────────────────────────────────

    @gl.public.write
    def claim_faucet(self) -> int:
        """Hand 100,000 ELF to the caller once. No throttling beyond that."""
        sender = gl.message.sender_address
        if sender in self.faucet_claimed and bool(self.faucet_claimed[sender]):
            raise gl.vm.UserError("faucet already claimed for this address")
        self.faucet_claimed[sender] = True
        current = int(self.balances[sender]) if sender in self.balances else 0
        self.balances[sender] = u256(current + FAUCET_AMOUNT)
        self.total_supply = u256(int(self.total_supply) + FAUCET_AMOUNT)
        return FAUCET_AMOUNT

    @gl.public.view
    def has_claimed(self, who: Address) -> bool:
        return who in self.faucet_claimed and bool(self.faucet_claimed[who])

    # ──────────────────────────────── transfers ─────────────────────────────

    @gl.public.write
    def transfer(self, to: Address, amount: int) -> bool:
        sender = gl.message.sender_address
        return self._transfer(sender, to, amount)

    def _transfer(self, from_addr: Address, to: Address, amount: int) -> bool:
        if amount <= 0:
            raise gl.vm.UserError("amount must be > 0")
        from_bal = int(self.balances[from_addr]) if from_addr in self.balances else 0
        if from_bal < amount:
            raise gl.vm.UserError("insufficient balance")
        to_bal = int(self.balances[to]) if to in self.balances else 0
        self.balances[from_addr] = u256(from_bal - amount)
        self.balances[to] = u256(to_bal + amount)
        return True

    # ───────────────────────────────── views ────────────────────────────────

    @gl.public.view
    def balance_of(self, who: Address) -> str:
        if who not in self.balances:
            return "0"
        return str(int(self.balances[who]))

    @gl.public.view
    def get_total_supply(self) -> str:
        return str(int(self.total_supply))

    @gl.public.view
    def name(self) -> str:
        return "ELBALPH Token"

    @gl.public.view
    def symbol(self) -> str:
        return "ELF"

    @gl.public.view
    def decimals(self) -> int:
        return 18
