import { Events } from './../events/Events';
import { WeaponAsset } from './../assets/WeaponAsset';
import { AudioAsset } from '../assets/AudioAsset';
import { PlayerAsset, PlayerAssetData } from '../assets/PlayerAsset';
import Phaser from 'phaser';
import EventDispatcher from '../events/EventDispatcher';
import Weapon from './Weapon';
import WeaponAssetFactory from '../factory/WeaponModelFactory';

export enum PlayerState
{
  Default,
  Talking,
  FinishTalking
}

export interface PlayerConfig
{
  asset: PlayerAsset;
  bodyWidth: number;
  bodyHeight: number;
  bodyOffsetX: number;
  bodyOffsetY: number;
}

/**
 * The player to control.
 * @class
 */
class Player extends Phaser.GameObjects.Sprite
{

  // the maximum hit points of the player
  private static readonly MAX_HIT_POINTS = 8;

  // how fast the player moves
  private static readonly MOVE_SPEED = 64;

  // the offsets from origin to player's hands
  public static readonly HANDS_OFFSET_X = 8;
  public static readonly HANDS_OFFSET_Y = 8;

  // the texture path of the player
  private asset: PlayerAsset;

  // keyboard key for moving up
  private keyW: Phaser.Input.Keyboard.Key;

  // keyboard key for moving left
  private keyA: Phaser.Input.Keyboard.Key;

  // keyboard key for moving down
  private keyS: Phaser.Input.Keyboard.Key;

  // keyboard key for moving right
  private keyD: Phaser.Input.Keyboard.Key;

  // keyboard key for action (attack or talk) 
  private keyJ: Phaser.Input.Keyboard.Key;

  // weapon the player is currently holding
  private weapon: Weapon;

  // current hit points
  private hitPoints: number; 

  private attackEnabled: boolean;

  // change update behavior based on current state
  private currentState: PlayerState;

  // the time elapsed since current state has been set
  private elapsedTime: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PlayerConfig)
  {
    super(scene, x, y, config.asset);

    // initialize memeber variables
    this.asset = config.asset;
    this.hitPoints = Player.MAX_HIT_POINTS;
    this.weapon = new Weapon(this.scene, WeaponAssetFactory.create(WeaponAsset.RegularSword));
    this.attackEnabled = true;
    this.currentState = PlayerState.Default;
    this.elapsedTime = 0;
    
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
      key: this.getIdleAnimationKey(), 
      frames: this.scene.anims.generateFrameNames(this.asset, 
        {
          prefix: PlayerAssetData.IdleAnimationPrefix as string,
          end: PlayerAssetData.IdleAnimationFrameEnd as number,
        }
      ),
      frameRate: 8
    });

    this.scene.anims.create({
      key: this.getRunAnimationKey(),
      frames: this.scene.anims.generateFrameNames(this.asset, 
        { 
          prefix: PlayerAssetData.RunAnimationPrefix as string,
          end: PlayerAssetData.RunAnimationFrameEnd as number,
        }
      ),
      frameRate: 8
    });

    // set collision bounds
    this.getBody().setSize(config.bodyWidth, config.bodyHeight);
    this.getBody().setOffset(config.bodyOffsetX, config.bodyOffsetY);

    // initialize event handlings
    EventDispatcher.getInstance().on(Events.Event.ItemSlotChange, this.handleItemSlotChange, this);

    // remove event listener when the scene is removed
    this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventDispatcher.getInstance().off(Events.Event.ItemSlotChange, this.handleItemSlotChange, this);
    });

  }

  /**
   * This method is called by enemies when they attack the player.
   * @param {number} damage - the amount of damage to receive 
   */
  public receiveDamage(damage: number)
  {
    this.setFrame(this.asset + PlayerAssetData.HitFrameKey);

    this.hitPoints = Math.max(0, this.hitPoints - damage);

    this.scene.sound.play(AudioAsset.DamagePlayer);

    // game over
    if (this.hitPoints === 0)
    {
      EventDispatcher.getInstance().emit(Events.Event.PlayerDies, { scene: this.scene });
    }

    const cameraTopLeftX = this.scene.cameras.main.worldView.x;
    const cameraTopLeftY = this.scene.cameras.main.worldView.y;

    const ratioX = (this.x - cameraTopLeftX) / this.scene.cameras.main.width;
    const ratioY = (this.y - cameraTopLeftY) / this.scene.cameras.main.height;

    const canvasWidth = this.scene.cameras.main.width * this.scene.cameras.main.zoom;
    const canvasHeight = this.scene.cameras.main.height * this.scene.cameras.main.zoom;

    EventDispatcher.getInstance().emit(Events.Event.Damage, 
      { damage: damage, x: ratioX * canvasWidth, y: ratioY * canvasHeight, color: 0xff0000 } as Events.Data.Damage);
    
    EventDispatcher.getInstance().emit(Events.Event.PlayerHpChange, 
      { currentHitPoints: this.hitPoints } as Events.Data.PlayerHpChange);

  }

  /**
   * This should be called every frame.
   */
  public update(delta: number): void
  {
    
    if (this.currentState === PlayerState.Default)
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
    }
    else if (this.currentState === PlayerState.Talking)
    {
      this.getBody().setVelocity(0, 0);
    }
    else if (this.currentState === PlayerState.FinishTalking)
    {
      if (this.elapsedTime > 200)
      {
        this.currentState = PlayerState.Default;
      }
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
      this.anims.play(this.getIdleAnimationKey(), true);
      this.getBody().setImmovable(true);
    }
    else
    {
      this.anims.play(this.getRunAnimationKey(), true);
      this.getBody().setImmovable(false);
    }

    this.weapon.update(this, this.attackEnabled);

    this.elapsedTime += delta;

  }

  /**
   * Return whether the player is trying to attack regardless of whether the 
   * player is already attacking. If this returns `true`, the weapon will 
   * start to rotate.
   * @see Weapon#update
   * @return {boolean} - whether the player is trying to attack
   */
  public isActionKeyDown(): boolean
  {
    return this.keyJ.isDown;
  }

  /**
   * Get the physics body
   * @return {Phaser.Physics.Arcade.Body} - the physics body
   */
  public getBody(): Phaser.Physics.Arcade.Body
  {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /**
   * Get the weapon the player is holding
   * @return {Weapon} - the weapon player is holding
   */
  public getWeapon(): Weapon
  {
    return this.weapon;
  }

  /**
   * Get the center of the physics body
   * @return {Phaser.Math.Vector2} - the center of the physics body
   */
  public getBodyCenter(): Phaser.Math.Vector2
  {
    return new Phaser.Math.Vector2(
      this.getBody().x + this.getBody().width / 2,
      this.getBody().y + this.getBody().height / 2
    );
  }

  public setAttackEnabled(enabled: boolean): void
  {
    this.attackEnabled = enabled;
  } 

  /**
   * Get the key for idle animation.
   */
  private getIdleAnimationKey(): string
  {
    return `${this.asset}:${PlayerAssetData.IdleAnimationPrefix}`;
  }

  /**
   * Get the key for running animation.
   */
  private getRunAnimationKey(): string
  {
    return `${this.asset}:${PlayerAssetData.RunAnimationPrefix}`;
  }

  /**
   * Callback for {@link Events.Event#ItemSlotChange} event.
   * @param {Events.Data.ItemSlotChange} data - the data associated with this event
   */
  private handleItemSlotChange(data: Events.Data.ItemSlotChange): void
  {
    if (data.currentWeaponAsset)
    {
      this.weapon.setModel(WeaponAssetFactory.create(data.currentWeaponAsset));
      this.weapon.getBody().setEnable(true);
      this.weapon.setVisible(true);
    }
    else
    {
      this.weapon.setVisible(false);
      this.weapon.getBody().setEnable(false);
    }
  }

  public setCurrentState(state: PlayerState)
  {
    this.currentState = state;
    this.elapsedTime = 0;
  }

  public getCurrentState()
  {
    return this.currentState;
  }
  
}

export default Player;