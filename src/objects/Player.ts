import { AudioAsset } from './../assets/AudioAsset';
import { PlayerHpChangeEventData, DamageEventData } from './../events/Event';
import { WeaponAsset } from './../assets/WeaponAsset';
import { PlayerAsset, PlayerAssetData } from './../assets/PlayerAsset';
import Phaser from 'phaser';
import EventDispatcher from '../events/EventDispatcher';
import { Event } from '../events/Event';
import Weapon from './Weapon';

class Player extends Phaser.GameObjects.Sprite
{

  // how fast the player moves
  private static readonly MOVE_SPEED = 64;

  // how fast the weapon rotates
  private static readonly WEAPON_ROTATION_SPEED = 16;

  // the dimensions of the physics body
  private static readonly COLLISION_BODY_WIDTH = 16;
  private static readonly COLLISION_BODY_HEIGHT = 16;

  // the spritesheet path of the player
  private asset: PlayerAsset;

  // keyboard key for moving up
  private keyW: Phaser.Input.Keyboard.Key;

  // keyboard key for moving left
  private keyA: Phaser.Input.Keyboard.Key;

  // keyboard key for moving down
  private keyS: Phaser.Input.Keyboard.Key;

  // keyboard key for moving right
  private keyD: Phaser.Input.Keyboard.Key;

  // keyboard key for attacking 
  private keyJ: Phaser.Input.Keyboard.Key;

  // weapon the player is currently holding
  private weapon: Weapon;

  /**
   * player status
   * will be migrated into its own class
   */
  private hitPoints: number; // HP
  private maxHitPoints: number;
  private magicPoints: number; // MP
  private maxMagicPoints: number;

  constructor(scene: Phaser.Scene, x: number, y: number, asset: PlayerAsset, weapon: Weapon)
  {
    super(scene, x, y, asset);

    this.asset = asset;
    this.hitPoints = this.maxHitPoints = 100;
    this.magicPoints = this.maxMagicPoints = 100;
    this.weapon = weapon;
    
    // add player to the scene
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.getBody().setCollideWorldBounds(true);

    // get references to the keyboard
    this.keyW = this.scene.input.keyboard.addKey('W');
    this.keyA = this.scene.input.keyboard.addKey('A');
    this.keyS = this.scene.input.keyboard.addKey('S');
    this.keyD = this.scene.input.keyboard.addKey('D');
    this.keyJ = this.scene.input.keyboard.addKey('J');

    // register animations
    this.scene.anims.create({
      key: asset + ":idle",
      frames: this.scene.anims.generateFrameNames(asset, 
        { start: PlayerAssetData.IdleAnimationFrameStart, 
          end: PlayerAssetData.IdleAnimationFrameEnd }),
      frameRate: 8
    });

    this.scene.anims.create({
      key: asset + ":run",
      frames: this.scene.anims.generateFrameNames(asset, 
        { start: PlayerAssetData.RunAnimationFrameStart, 
          end: PlayerAssetData.RunAnimationFrameEnd }),
      frameRate: 8
    });

    // set collision bounds
    this.getBody().setSize(Player.COLLISION_BODY_WIDTH, Player.COLLISION_BODY_HEIGHT);
    this.getBody().setOffset(0, PlayerAssetData.FrameHeight - Player.COLLISION_BODY_HEIGHT);

    this.getBody().setImmovable(true);
  }

  public receiveDamage(damage: number)
  {
    this.setFrame(PlayerAssetData.HitFrame);
    this.hitPoints = Math.max(0, this.hitPoints - damage);

    if (this.hitPoints === 0)
    {
      this.scene.scene.stop("UIScene");
      this.scene.scene.start("GameOverScene");
    }

    this.scene.sound.play(AudioAsset.DamagePlayer);

    EventDispatcher.getInstance().emit(Event.Damage, 
      { damage: damage, x: this.x, y: this.y, color: 0xff0000 } as DamageEventData);
    
    EventDispatcher.getInstance().emit(Event.PlayerHpChange, 
      { hitPoints: this.hitPoints, maxHitPoints: this.maxHitPoints } as PlayerHpChangeEventData);
  }

  public update()
  {

    // update velocity
    if (this.keyW.isDown && this.keyA.isDown)
    {
      this.getBody().setVelocity(-1, -1);
      this.getBody().velocity.normalize().scale(Player.MOVE_SPEED);
    }
    else if (this.keyS.isDown && this.keyA.isDown)
    {
      this.getBody().setVelocity(-1, 1);
      this.getBody().velocity.normalize().scale(Player.MOVE_SPEED);
    }
    else if (this.keyS.isDown && this.keyD.isDown)
    {
      this.getBody().setVelocity(1, 1);
      this.getBody().velocity.normalize().scale(Player.MOVE_SPEED);
    }
    else if (this.keyW.isDown && this.keyD.isDown)
    {
      this.getBody().setVelocity(1, -1);
      this.getBody().velocity.normalize().scale(Player.MOVE_SPEED);
    }
    else if (this.keyW.isDown)
    {
      this.getBody().setVelocity(0, -Player.MOVE_SPEED);
    }
    else if (this.keyA.isDown)
    {
      this.getBody().setVelocity(-Player.MOVE_SPEED, 0);
    }
    else if (this.keyS.isDown)
    {
      this.getBody().setVelocity(0, Player.MOVE_SPEED);
    }
    else if (this.keyD.isDown)
    {
      this.getBody().setVelocity(Player.MOVE_SPEED, 0);
    }
    else 
    {
      this.getBody().setVelocity(0, 0);
    }

    // update flip x
    if (this.getBody().velocity.x > 0)
    {
      this.setFlipX(false);
      this.weapon.setFlipX(false);
    }
    else if (this.getBody().velocity.x < 0)
    {
      this.setFlipX(true);
      this.weapon.setFlipX(true);
    }

    // update frame and physics body
    if (this.getBody().velocity.x === 0 && this.getBody().velocity.y === 0)
    {
      this.anims.play(this.asset + ":idle", true);
      this.getBody().setImmovable(true);
    }
    else
    {
      this.anims.play(this.asset + ":run", true);
      this.getBody().setImmovable(false);
    }

    this.weapon.update(this);

  }

  public isActivatingWeapon()
  {
    return Phaser.Input.Keyboard.JustDown(this.keyJ);
  }

  public getBody(): Phaser.Physics.Arcade.Body
  {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  public getWeaponBody(): Phaser.Physics.Arcade.Body
  {
    return this.weapon.body as Phaser.Physics.Arcade.Body;
  }

  public getWeapon()
  {
    return this.weapon;
  }

  public isAttacking()
  {
    return this.weapon.isRotating();
  }

}

export default Player;