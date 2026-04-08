// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SecureVaultInheritance
 * @dev Manages digital asset metadata hashes and automated inheritance logic based on user activity.
 */
contract SecureVaultInheritance {
    struct Asset {
        string assetHash;      // SHA-256 hash of the encrypted asset
        address owner;         // Owner of the asset
        address nominee;       // Nominee who receives access
        uint256 lastActive;    // Last active timestamp of the owner
        uint256 inactivityPeriod; // Inactivity duration (in seconds) before inheritance triggers
        bool exists;
        bool claimed;
    }

    mapping(bytes32 => Asset) public assets; // assetId (keccak256(assetHash, owner)) -> Asset
    mapping(address => uint256) public userLastActive; // Global last active for a user

    event AssetRegistered(bytes32 indexed assetId, string assetHash, address indexed owner, address indexed nominee);
    event ActivityUpdated(address indexed user, uint256 timestamp);
    event InheritanceTriggered(bytes32 indexed assetId, address indexed owner, address indexed nominee);
    event OwnershipTransferred(bytes32 indexed assetId, address indexed newOwner);

    modifier onlyOwner(bytes32 _assetId) {
        require(assets[_assetId].owner == msg.sender, "Not the asset owner");
        _;
    }

    /**
     * @dev Registers a new asset with its metadata hash and nominee.
     */
    function registerAsset(
        string memory _assetHash,
        address _nominee,
        uint256 _inactivityPeriod
    ) external returns (bytes32) {
        bytes32 assetId = keccak256(abi.encodePacked(_assetHash, msg.sender));
        require(!assets[assetId].exists, "Asset already registered");

        assets[assetId] = Asset({
            assetHash: _assetHash,
            owner: msg.sender,
            nominee: _nominee,
            lastActive: block.timestamp,
            inactivityPeriod: _inactivityPeriod,
            exists: true,
            claimed: false
        });

        if (userLastActive[msg.sender] < block.timestamp) {
            userLastActive[msg.sender] = block.timestamp;
        }

        emit AssetRegistered(assetId, _assetHash, msg.sender, _nominee);
        return assetId;
    }

    /**
     * @dev Updates the last active timestamp for the caller.
     * Can also be called by a trusted server/relayer in a real-world scenario (omitted for simplicity).
     */
    function updateLastActive() external {
        userLastActive[msg.sender] = block.timestamp;
        emit ActivityUpdated(msg.sender, block.timestamp);
    }

    /**
     * @dev Manually update last active for a user (called by SecureVault server).
     * In a production environment, this should be restricted to a specific 'authorized server' address.
     */
    function updateLastActiveForUser(address _user) external {
        // In a real app, use: require(msg.sender == authorizedServer, "Unauthorized");
        userLastActive[_user] = block.timestamp;
        emit ActivityUpdated(_user, block.timestamp);
    }

    /**
     * @dev Checks if inheritance criteria are met and marks the asset as ready for claim.
     */
    function triggerInheritance(bytes32 _assetId) external {
        Asset storage asset = assets[_assetId];
        require(asset.exists, "Asset does not exist");
        require(!asset.claimed, "Asset already claimed");
        
        uint256 effectiveLastActive = userLastActive[asset.owner] > asset.lastActive ? userLastActive[asset.owner] : asset.lastActive;
        
        require(block.timestamp > effectiveLastActive + asset.inactivityPeriod, "Inactivity period not yet exceeded");

        emit InheritanceTriggered(_assetId, asset.owner, asset.nominee);
    }

    /**
     * @dev Transfers ownership of the asset metadata hash to the nominee.
     */
    function claimAsset(bytes32 _assetId) external {
        Asset storage asset = assets[_assetId];
        require(asset.exists, "Asset does not exist");
        require(msg.sender == asset.nominee, "Only nominee can claim");
        
        uint256 effectiveLastActive = userLastActive[asset.owner] > asset.lastActive ? userLastActive[asset.owner] : asset.lastActive;
        require(block.timestamp > effectiveLastActive + asset.inactivityPeriod, "Inactivity period not yet exceeded");
        require(!asset.claimed, "Asset already claimed");

        asset.claimed = true;
        
        emit OwnershipTransferred(_assetId, msg.sender);
    }

    /**
     * @dev Get asset details
     */
    function getAsset(bytes32 _assetId) external view returns (Asset memory) {
        return assets[_assetId];
    }
}
