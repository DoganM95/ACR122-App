# ACR122-App
A web based app to control the acr122u nfc card reader hardware

# Setup

## Host Machine (Rockstor, based on OpenSUSE (linux))

Perhaps not all of these steps are necessay (if any), but helped in testing to get it running.

The host, this container will run on is supposedly prepared by installing packages and necessary tools

```bash
zypper install pcsc-lite pcsc-tools ccid
```

Adding NFC and pn533 to the blacklist, to prevent the kernel NFC drivers from interfering

```bash
echo "install nfc /bin/false" | sudo tee -a /etc/modprobe.d/blacklist.conf
echo "install pn533 /bin/false" | sudo tee -a /etc/modprobe.d/blacklist.conf
```

Restarting the `pcscd` service to apply changes

```bash
systemctl restart pcscd
systemctl enable pcscd
```

And then rebooting

```bash
reboot
```


## Docker Container

The privileges it gets need to be tested to see if they are really necessary.  

- `acr122u-js-staging` is the unstable package that is used to test new implementations
- `acr122u-js` is the package to use normally, containing the stable master branch app

```bash
docker run \
  --cap-add=SYS_ADMIN \
  --cap-add=MKNOD \
  -d \
  --device /dev/bus/usb \
  --name acr \
  --privileged \
  --pull always \
  --restart always \
  ghcr.io/doganm95/acr122u-js:latest
```
