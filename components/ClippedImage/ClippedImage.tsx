const ClippedImage = ({ image, className }) => {
  return (
    <div className={`relative w-full h-64 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          width: "100%",
          backgroundImage: `url("/${image}")`,
          backgroundPosition: "center -65%",
          backgroundSize: "50%", // Adjust the size to scale the image
          clipPath: "polygon(25% 0%, 100% 0%, 100% 52%, 25% 46%)",
          transform: "scale(1.3)", // Zooms the image by 20%
          overflow: "hidden",
        }}
      />
    </div>
  );
};

export default ClippedImage;
