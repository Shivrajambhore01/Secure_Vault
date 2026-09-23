"""
Cryptographic Merkle-Tree Proof of Solvency & Custody Engine — Phase 23.
Generates zero-knowledge-style inclusion proofs of vaulted assets and commitments
allowing independent auditors to verify institutional solvency without compromising privacy.
"""

import hashlib
import json
from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ProofDirection(str, Enum):
    LEFT = "LEFT"
    RIGHT = "RIGHT"


class ProofNode(BaseModel):
    sibling_hash: str
    direction: ProofDirection


class SolvencyProof(BaseModel):
    asset_id: str
    leaf_hash: str
    merkle_root: str
    proof_path: List[ProofNode]
    is_valid: bool = True


class MerkleTree:
    """Binary cryptographic Merkle tree constructed from asset commitments."""

    def __init__(self, leaves: List[str]):
        if not leaves:
            raise ValueError("Cannot construct Merkle tree with zero leaves.")
        self.leaves: List[str] = leaves
        self.layers: List[List[str]] = [leaves]
        self._build_tree()

    def _hash_pair(self, left: str, right: str) -> str:
        combined = left + right
        return hashlib.sha256(combined.encode("utf-8")).hexdigest()

    def _build_tree(self):
        current = self.leaves
        while len(current) > 1:
            next_layer = []
            for i in range(0, len(current), 2):
                left = current[i]
                right = current[i + 1] if i + 1 < len(current) else current[i]
                parent = self._hash_pair(left, right)
                next_layer.append(parent)
            self.layers.append(next_layer)
            current = next_layer

    @property
    def root(self) -> str:
        return self.layers[-1][0]

    def get_proof(self, leaf_index: int) -> List[ProofNode]:
        """Generate audit inclusion proof path for a leaf at leaf_index."""
        if leaf_index < 0 or leaf_index >= len(self.leaves):
            raise IndexError("Leaf index out of range.")

        proof = []
        idx = leaf_index
        for layer in self.layers[:-1]:
            is_right_child = (idx % 2 == 1)
            sibling_idx = idx - 1 if is_right_child else idx + 1
            if sibling_idx >= len(layer):
                sibling_idx = idx

            direction = ProofDirection.LEFT if is_right_child else ProofDirection.RIGHT
            proof.append(ProofNode(sibling_hash=layer[sibling_idx], direction=direction))
            idx = idx // 2
        return proof


class ProofOfSolvencyEngine:
    """Enterprise Proof-of-Solvency coordinator managing asset commitments and Merkle verification."""

    def __init__(self):
        self._default_commitments: List[Dict[str, Any]] = [
            {"asset_id": "ast_btc_cold_01", "vault_id": "vlt_inst_01", "type": "CRYPTO_VAULT", "units": 250, "salt": "slt_9912a"},
            {"asset_id": "ast_eth_custody_02", "vault_id": "vlt_inst_01", "type": "CRYPTO_VAULT", "units": 4500, "salt": "slt_8841b"},
            {"asset_id": "ast_real_estate_deed_03", "vault_id": "vlt_inst_02", "type": "REAL_ESTATE", "units": 1, "salt": "slt_7721c"},
            {"asset_id": "ast_swiss_gold_cert_04", "vault_id": "vlt_inst_03", "type": "PRECIOUS_METALS", "units": 100, "salt": "slt_6619d"},
            {"asset_id": "ast_equity_escrow_05", "vault_id": "vlt_inst_04", "type": "EQUITY", "units": 50000, "salt": "slt_5514e"},
        ]
        self._tree: Optional[MerkleTree] = None
        self._rebuild_tree()

    def compute_leaf_hash(self, item: Dict[str, Any]) -> str:
        """Derive deterministic cryptographic leaf commitment."""
        serialized = f"{item.get('vault_id')}:{item.get('asset_id')}:{item.get('type')}:{item.get('units')}:{item.get('salt')}"
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def _rebuild_tree(self):
        leaves = [self.compute_leaf_hash(c) for c in self._default_commitments]
        self._tree = MerkleTree(leaves)

    def get_merkle_root(self) -> Dict[str, Any]:
        """Retrieve current solvency state root hash and commitment metrics."""
        return {
            "merkle_root": self._tree.root,
            "total_assets_committed": len(self._default_commitments),
            "algorithm": "SHA-256 Binary Merkle Tree",
            "audit_standard": "AICPA SOC2 / Proof-of-Solvency v1",
        }

    def generate_proof_for_asset(self, asset_id: str) -> Optional[SolvencyProof]:
        """Generate verifiable inclusion proof for a vaulted asset."""
        for idx, item in enumerate(self._default_commitments):
            if item["asset_id"] == asset_id:
                leaf_hash = self.compute_leaf_hash(item)
                proof_path = self._tree.get_proof(idx)
                return SolvencyProof(
                    asset_id=asset_id,
                    leaf_hash=leaf_hash,
                    merkle_root=self._tree.root,
                    proof_path=proof_path,
                    is_valid=True,
                )
        return None

    @staticmethod
    def verify_inclusion(merkle_root: str, leaf_hash: str, proof_path: List[ProofNode]) -> bool:
        """
        Independently compute leaf -> root traversal and verify equality with published root.
        """
        current = leaf_hash
        for node in proof_path:
            if node.direction == ProofDirection.RIGHT:
                # Sibling is on the right: current + sibling
                combined = current + node.sibling_hash
            else:
                # Sibling is on the left: sibling + current
                combined = node.sibling_hash + current
            current = hashlib.sha256(combined.encode("utf-8")).hexdigest()

        return current.lower() == merkle_root.lower()


proof_of_solvency_engine = ProofOfSolvencyEngine()
